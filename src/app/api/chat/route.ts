import { NextRequest } from "next/server";
import { ToolLoopAgent, createAgentUIStreamResponse, UIMessage, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/ai/tools";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { checkCredits, deductCredits, CREDIT_COSTS } from "@/lib/credits";
import { logUsage } from "@/lib/ai/usage";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

const ALLOWED_MODELS = new Set([
  "anthropic/claude-haiku-4-5-20251001",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.6",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "google/gemini-flash",
  "google/gemini-pro",
]);

const AGENT_INSTRUCTIONS = `You are Layers, an AI assistant for knowledge teams. You have access to tools to search the team's knowledge base and read full documents.

Guidelines:
- Always call search_context before answering any question — do not rely on your training data alone
- Use multiple search queries with different angles if one query isn't sufficient
- Call get_document for documents that appear highly relevant to get their full content
- Be concise and specific in your final answer
- Cite sources by name and date using [Source: title (date)] format, e.g. [Source: Sprint Retro (2026-03-01)]
- If the knowledge base has no relevant information, say so clearly`;

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

  // Per-org tier-based rate limiting (hardcoded "free" until subscription tier lookup)
  const rateLimitResult = checkRateLimit(member.org_id, "free");
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil(
      (rateLimitResult.resetAt.getTime() - Date.now()) / 1000,
    );
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(rateLimitResult),
        },
      },
    );
  }

  // Credit check — block if insufficient
  const creditCheck = await checkCredits(member.org_id, CREDIT_COSTS.chat);
  if (!creditCheck.sufficient) {
    return new Response(
      JSON.stringify({
        error: "Insufficient credits",
        balance: creditCheck.balance,
        required: CREDIT_COSTS.chat,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return new Response("Invalid messages", { status: 400 });
  }

  const uiMessages: UIMessage[] = body.messages;

  if (uiMessages.length === 0) {
    return new Response("Invalid messages", { status: 400 });
  }

  // Validate each message has a role
  for (const msg of uiMessages) {
    if (!msg.role || !["user", "assistant", "system"].includes(msg.role)) {
      return new Response("Invalid message: missing or invalid role", { status: 400 });
    }
  }

  const modelId = ALLOWED_MODELS.has(body.model as string)
    ? (body.model as string)
    : "anthropic/claude-haiku-4-5-20251001";

  const conversationId: string | null = (body.conversationId as string) ?? null;

  // Extract first user message as the "query" for analytics
  const firstUserMsg = uiMessages.find((m) => m.role === "user");
  const query =
    (firstUserMsg?.parts as { type: string; text?: string }[] | undefined)
      ?.filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ")
      .slice(0, 500) ?? "";

  // Collect per-step data for the final log
  const startTime = Date.now();
  const toolCallCounts: Record<string, number> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let runStepCount = 0;
  let assistantText = "";

  const adminDb = createAdminClient();
  const orgId = member.org_id;
  const userId = user.id;

  // Save the new user message (last in array)
  const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMsg
    ? ((lastUserMsg.parts as { type: string; text?: string }[]) ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join(" ")
    : "";
  if (lastUserMsg) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (adminDb as any)
      .from("chat_messages")
      .insert({
        org_id: orgId,
        user_id: userId,
        session_id: null,
        conversation_id: conversationId,
        role: "user",
        content: (lastUserMsg.parts ?? []) as unknown as Json,
        model: null,
      })
      .then();
  }

  const agent = new ToolLoopAgent({
    model: gateway(modelId),
    instructions: AGENT_INSTRUCTIONS,
    tools: createTools(supabase, orgId),
    stopWhen: stepCountIs(6),
    onStepFinish: ({ usage, toolCalls, text }) => {
      runStepCount++;
      if (text) assistantText += text;
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
      // Deduct credits on successful completion
      void deductCredits(orgId, CREDIT_COSTS.chat, "chat").catch((err) => {
        console.error("[chat] credit deduction failed:", err);
      });

      // Log usage for billing/analytics
      logUsage({
        orgId,
        userId,
        operation: "chat",
        model: modelId,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        creditsUsed: CREDIT_COSTS.chat,
        metadata: {
          stepCount: runStepCount,
          durationMs: Date.now() - startTime,
          toolCalls: Object.entries(toolCallCounts).map(([tool, count]) => ({ tool, count })),
        },
      });

      const toolCallsArray = Object.entries(toolCallCounts).map(([tool, count]) => ({ tool, count }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (adminDb as any)
        .from("agent_runs")
        .insert({
          org_id: orgId,
          user_id: userId,
          model: modelId,
          query,
          step_count: runStepCount,
          finish_reason: "stop",
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          duration_ms: Date.now() - startTime,
          tool_calls: toolCallsArray,
          error: null,
        });

      // Save the assistant response
      if (assistantText) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void (adminDb as any)
          .from("chat_messages")
          .insert({
            org_id: orgId,
            user_id: userId,
            session_id: null,
            conversation_id: conversationId,
            role: "assistant",
            content: [{ type: "text", text: assistantText }],
            model: modelId,
          })
          .then();
      }

      // Auto-title: set conversation title after first assistant response
      if (conversationId && lastUserText) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void (adminDb as any)
          .from("conversations")
          .update({
            title: lastUserText.slice(0, 50),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId)
          .is("title", null)
          .then();
      }
    },
  });

  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages,
  });

  // Attach rate limit headers to the streaming response
  const rlHeaders = rateLimitHeaders(rateLimitResult);
  for (const [key, value] of Object.entries(rlHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
