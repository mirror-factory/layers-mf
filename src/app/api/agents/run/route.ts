import { NextRequest } from "next/server";
import { ToolLoopAgent, createAgentUIStreamResponse, UIMessage, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/ai/tools";
import { getAgentTemplate } from "@/lib/agents/templates";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { checkCredits, deductCredits, CREDIT_COSTS } from "@/lib/credits";
import { logUsage } from "@/lib/ai/usage";

export const maxDuration = 60;

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  // Rate limiting
  const rateLimitResult = checkRateLimit(member.org_id, "free");
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil(
      (rateLimitResult.resetAt.getTime() - Date.now()) / 1000,
    );
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retryAfter }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(rateLimitResult),
        },
      },
    );
  }

  // Credit check — bypass in demo mode
  const demoMode = process.env.DEMO_MODE === "true";
  if (!demoMode) {
    const creditCheck = await checkCredits(member.org_id, CREDIT_COSTS.chat);
    if (!creditCheck.sufficient) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          balance: creditCheck.balance,
          required: CREDIT_COSTS.chat,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const templateId = body.templateId as string | undefined;
  if (!templateId) {
    return new Response(
      JSON.stringify({ error: "templateId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const template = getAgentTemplate(templateId);
  if (!template) {
    return new Response(
      JSON.stringify({ error: `Unknown template: ${templateId}` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const queryText = (body.query as string) ?? "";
  if (!queryText.trim()) {
    return new Response(
      JSON.stringify({ error: "query is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Build UI messages from the query
  const uiMessages: UIMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: queryText }],
    },
  ];

  // Build the system prompt with content filter hints
  let instructions = template.systemPrompt;
  if (template.contentFilters) {
    const filterHints: string[] = [];
    if (template.contentFilters.source_types?.length) {
      filterHints.push(
        `Preferred source types: ${template.contentFilters.source_types.join(", ")}`,
      );
    }
    if (template.contentFilters.content_types?.length) {
      filterHints.push(
        `Preferred content types: ${template.contentFilters.content_types.join(", ")}`,
      );
    }
    if (filterHints.length > 0) {
      instructions += `\n\nContent filter hints (use these in search_context filters when relevant):\n${filterHints.join("\n")}`;
    }
  }

  const orgId = member.org_id;
  const userId = user.id;
  const startTime = Date.now();
  const toolCallCounts: Record<string, number> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let runStepCount = 0;

  const adminDb = createAdminClient();

  const agent = new ToolLoopAgent({
    model: gateway(DEFAULT_MODEL),
    instructions,
    tools: createTools(supabase, orgId),
    stopWhen: stepCountIs(6),
    onStepFinish: ({ usage, toolCalls }) => {
      runStepCount++;
      if (usage) {
        totalInputTokens += usage.inputTokens ?? 0;
        totalOutputTokens += usage.outputTokens ?? 0;
      }
      if (toolCalls) {
        for (const tc of toolCalls) {
          const name = tc.toolName ?? "unknown";
          toolCallCounts[name] = (toolCallCounts[name] ?? 0) + 1;
        }
      }
    },
    onFinish: () => {
      void deductCredits(orgId, CREDIT_COSTS.chat, "agent_template").catch(
        (err) => console.error("[agent-run] credit deduction failed:", err),
      );

      logUsage({
        orgId,
        userId,
        operation: "agent_template",
        model: DEFAULT_MODEL,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        creditsUsed: CREDIT_COSTS.chat,
        metadata: {
          templateId,
          stepCount: runStepCount,
          durationMs: Date.now() - startTime,
          toolCalls: Object.entries(toolCallCounts).map(([tool, count]) => ({
            tool,
            count,
          })),
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (adminDb as any)
        .from("agent_runs")
        .insert({
          org_id: orgId,
          user_id: userId,
          model: DEFAULT_MODEL,
          query: queryText.slice(0, 500),
          step_count: runStepCount,
          finish_reason: "stop",
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          duration_ms: Date.now() - startTime,
          tool_calls: Object.entries(toolCallCounts).map(([tool, count]) => ({
            tool,
            count,
          })),
          error: null,
        });
    },
  });

  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages,
  });

  const rlHeaders = rateLimitHeaders(rateLimitResult);
  for (const [key, value] of Object.entries(rlHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
