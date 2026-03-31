import { NextRequest } from "next/server";
import {
  ToolLoopAgent,
  createAgentUIStreamResponse,
  UIMessage,
  stepCountIs,
} from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createSessionTools } from "@/lib/ai/session-tools";
import { rateLimit } from "@/lib/rate-limit";
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

function buildSessionInstructions(
  sessionName: string,
  sessionGoal: string
): string {
  return `You are Granger, an AI assistant for knowledge teams. You are working within the session "${sessionName}".

Session goal: ${sessionGoal}

Guidelines:
- Always call search_context before answering any question — do not rely on your training data alone
- Your search only covers documents linked to this session, not the entire knowledge base
- Use multiple search queries with different angles if one query isn't sufficient
- Call get_document for documents that appear highly relevant to get their full content
- Be concise and specific in your final answer
- Cite sources by title when you use information from them
- If the session's linked documents have no relevant information, say so clearly
- Stay focused on the session goal when possible`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { success, remaining } = rateLimit(`chat-session:${user.id}`, 10, 60_000);
  if (!success) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "X-RateLimit-Remaining": "0" },
    });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  // Verify session belongs to user's org
  const { data: session } = await supabase
    .from("sessions")
    .select("id, name, goal")
    .eq("id", sessionId)
    .eq("org_id", member.org_id)
    .single();

  if (!session) {
    return new Response("Session not found", { status: 404 });
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

  const firstUserMsg = uiMessages.find((m) => m.role === "user");
  const query =
    (firstUserMsg?.parts as { type: string; text?: string }[] | undefined)
      ?.filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ")
      .slice(0, 500) ?? "";

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
  if (lastUserMsg) {
    void adminDb
      .from("chat_messages")
      .insert({
        org_id: orgId,
        user_id: userId,
        session_id: sessionId,
        role: "user",
        content: (lastUserMsg.parts ?? []) as unknown as Json,
        model: null,
      })
      .then();
  }

  const agent = new ToolLoopAgent({
    model: gateway(modelId),
    instructions: buildSessionInstructions(
      session.name as string,
      session.goal as string
    ),
    tools: createSessionTools(supabase, orgId, sessionId),
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
      const toolCallsArray = Object.entries(toolCallCounts).map(
        ([tool, count]) => ({ tool, count })
      );
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
      // Update session last_agent_run
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (adminDb as any)
        .from("sessions")
        .update({ last_agent_run: new Date().toISOString() })
        .eq("id", sessionId);

      // Save the assistant response
      if (assistantText) {
        void adminDb
          .from("chat_messages")
          .insert({
            org_id: orgId,
            user_id: userId,
            session_id: sessionId,
            role: "assistant",
            content: [{ type: "text", text: assistantText }],
            model: modelId,
          })
          .then();
      }
    },
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
  });
}
