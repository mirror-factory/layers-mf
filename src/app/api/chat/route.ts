import { NextRequest } from "next/server";
import { ToolLoopAgent, createAgentUIStreamResponse, UIMessage, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createTools, type ToolClients } from "@/lib/ai/tools";
import { GranolaClient, LinearApiClient, NotionClient, GmailClient, DriveClient } from "@/lib/api";
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

const AGENT_INSTRUCTIONS = `You are Granger, Mirror Factory's AI chief of staff. You serve three partners: Alfonso, Kyle, and Bobby.

## Your Tools
You have these tools available — use the RIGHT tool for the job:

**Knowledge Search (searches Supabase context library):**
- search_context — search documents, meetings, notes in the knowledge base
- get_document — fetch full content of a specific document by ID

**Linear (direct API — zero AI token cost):**
- list_linear_issues — query issues with state/assignee/team/priority filters. USE THIS when asked about tasks, issues, or Linear.
- create_linear_issue — create a new issue (routes through approval queue)

**Granola (direct API):**
- query_granola — search meeting transcripts and notes

**Gmail (direct API):**
- search_gmail — search emails with Gmail query syntax (from:, subject:, newer_than:, is:unread)
- draft_email — draft an email (routes through approval queue)

**Notion (direct API):**
- search_notion — search pages and databases

**Google Drive (direct API):**
- list_drive_files — list and search Drive files

**Actions:**
- propose_action — propose any write action for partner approval

## Slash Commands
Users may use slash commands. When you see these, call the corresponding tool directly:
- /linear or /tasks → call list_linear_issues
- /gmail [query] → call search_gmail with the query
- /notion → call search_notion
- /granola → call query_granola
- /drive → call list_drive_files
- /approve → describe pending approvals from search_context

## Guidelines
- Use the direct API tools (list_linear_issues, search_gmail, etc.) when asked about those services — do NOT search the knowledge base for Linear issues when you can query Linear directly
- Call search_context for general knowledge questions, meeting decisions, or cross-source queries
- Be concise and direct — lead with the answer, then explain
- Cite sources by name and date: [Source: title (date)]
- All write actions MUST go through the approval queue — never execute directly
- If a tool returns "not configured", tell the user to add their API key in Settings → API Keys`;

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

  // Credit check — bypass in demo mode, block if insufficient
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
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
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

  // Track chat query as a user interaction (fire-and-forget)
  if (query) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("user_interactions")
      .insert({
        org_id: orgId,
        user_id: userId,
        interaction_type: "chat_query",
        query,
        metadata: { model: modelId, conversationId },
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error("[chat] interaction tracking failed:", error.message);
      });
  }

  // Load credentials for this user (personal) and org (shared)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: creds } = await (supabase as any)
    .from("credentials")
    .select("provider, token_encrypted")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("org_id", orgId);

  const clients: ToolClients = {};
  for (const cred of creds ?? []) {
    switch (cred.provider) {
      case "granola":
        clients.granola = new GranolaClient(cred.token_encrypted);
        break;
      case "linear":
        clients.linear = new LinearApiClient(cred.token_encrypted);
        break;
      case "notion":
        clients.notion = new NotionClient(cred.token_encrypted);
        break;
      case "gmail":
        clients.gmail = new GmailClient(cred.token_encrypted);
        break;
      case "drive":
        clients.drive = new DriveClient(cred.token_encrypted);
        break;
    }
  }

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
    tools: createTools(supabase, orgId, clients),
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
      // Deduct credits on successful completion (skip in demo mode)
      if (!demoMode) {
        void deductCredits(orgId, CREDIT_COSTS.chat, "chat").catch((err) => {
          console.error("[chat] credit deduction failed:", err);
        });
      }

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

      // Compound loop: store substantial AI responses as searchable context items
      if (assistantText.length > 200) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void (adminDb as any)
          .from("context_items")
          .insert({
            org_id: orgId,
            source_type: "layers-ai",
            source_id: `chat-${conversationId}-${Date.now()}`,
            title: `AI Analysis: ${query.slice(0, 80)}`,
            raw_content: `Question: ${query}\n\nAnswer: ${assistantText}`,
            content_type: "document",
            status: "ready",
            ingested_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
          })
          .then(() => {})
          .catch(() => {});
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
