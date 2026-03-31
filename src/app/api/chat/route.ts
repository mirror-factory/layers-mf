import { NextRequest } from "next/server";
import { ToolLoopAgent, createAgentUIStreamResponse, UIMessage, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createTools, type ToolClients, type ToolPermissions } from "@/lib/ai/tools";
import { GranolaClient, LinearApiClient, NotionClient, GmailClient, DriveClient } from "@/lib/api";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { checkCredits, deductCredits, CREDIT_COSTS } from "@/lib/credits";
import { logUsage } from "@/lib/ai/usage";
import { loadRules, formatRulesForPrompt } from "@/lib/ai/priority-docs";
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

**Specialist Agents (delegate complex requests):**
- ask_linear_agent — Delegate to Linear specialist for ALL task/issue requests. It can list, create, update issues, manage projects, list teams.
- ask_gmail_agent — Delegate to Gmail specialist for email search, reading, drafting.
- ask_notion_agent — Delegate to Notion specialist for page/database queries and reading page content.
- ask_granola_agent — Delegate to Granola specialist for meeting transcript queries.
- ask_drive_agent — Delegate to Drive specialist for file search and reading.

Prefer using specialist agents over individual tools — they have deeper knowledge and can multi-step.

**Direct API Tools (for simple one-shot queries):**
- list_linear_issues — query issues with state/assignee/team/priority filters
- create_linear_issue — create a new issue (routes through approval queue)
- query_granola — search meeting transcripts and notes
- search_gmail — search emails with Gmail query syntax (from:, subject:, newer_than:, is:unread)
- draft_email — draft an email (routes through approval queue)
- search_notion — search pages and databases
- list_drive_files — list and search Drive files

**Scheduling:**
- schedule_action — create a recurring or one-time scheduled action
- list_schedules — list all scheduled actions (active, paused, or all)
- edit_schedule — edit a schedule's name, cron, status (pause/resume)
- delete_schedule — permanently remove a scheduled action

When users say "every morning check my Linear", convert to cron and call schedule_action.
When they say "pause that schedule", "change it to hourly", "delete the digest" → use edit_schedule or delete_schedule.
Common cron: "0 7 * * 1-5" = weekdays 7am, "0 */2 * * *" = every 2h, "once:ISO_DATE" = one-shot.

**Documents:**
- create_document — create a rich-text document artifact (memos, specs, reports, briefs). Opens in TipTap editor panel.
- edit_document — edit a specific section of an existing document by ID. Use for targeted edits without rewriting the whole thing.

**Code:**
- write_code — create a code artifact with inline preview. Best for static HTML/CSS/JS.
- run_code — execute a SINGLE file in a sandboxed VM. Use for quick scripts, computations, API calls.
- run_project — execute a MULTI-FILE project in sandbox. Use for full apps, npm projects, React apps, APIs with multiple routes, data pipelines. Supports: multiple files, npm/pip install, port exposure for live preview, reading output files back. More powerful than run_code.

CRITICAL CODE RULES:
- For React/JSX: Do NOT use run_code with raw JSX. Node.js cannot execute JSX. Instead use write_code with a SINGLE HTML file that loads React + ReactDOM + Babel from unpkg CDN, then write JSX inside a script tag with type="text/babel".
- For plain HTML/CSS: use write_code (inline preview) or run_code with language "html" (live sandbox URL)
- For Node.js scripts: use run_code with language "javascript" — write CommonJS (require), not ESM (import)
- For Python: use run_code with language "python"
- NEVER put JSX in a .js file for run_code — it will fail with SyntaxError

**Web Search:**
- web_search — search the web for current information via Perplexity. Use for recent events, facts, real-time data. Returns results with citations.

**Skills:**
- activate_skill — activate a skill by slug to load its instructions and tools
- create_skill — create a new custom skill. ALWAYS use ask_user first to interview the user, then call create_skill with the gathered info.
- create_tool_from_code — create a custom tool by writing code, testing it in sandbox, and saving as a skill with the code attached
- search_skills_marketplace — search the skills.sh marketplace

When asked to create a custom tool or automation:
1. Use ask_user to gather requirements (what the tool does, inputs it needs, expected output format)
2. Write the tool code as a CommonJS module exporting a run(input) function
3. Test it with create_tool_from_code providing realistic test_input
4. If tests fail, fix the code and call create_tool_from_code again
5. Once saved, tell the user they can activate it with the slash command

**Approvals:**
- list_approvals — query the approval queue directly. Use for /approve and when users ask about pending actions.
- propose_action — propose any write action for partner approval

## Slash Commands
Users may use slash commands. When you see these, call the corresponding tool:
- /linear or /tasks → call ask_linear_agent
- /gmail [query] → call ask_gmail_agent
- /notion → call ask_notion_agent
- /granola → call ask_granola_agent
- /drive → call ask_drive_agent
- /schedule → list scheduled actions (tell user to visit /schedules page to manage them)
- /approve → call list_approvals (NOT search_context)
- /search [query] → call web_search
- /skill create → start a skill creation interview using ask_user, then call create_skill

## Skill Creation Flow
When the user wants to create a skill (via "/skill create" or similar):
1. Call ask_user with questions about the skill: name, what it does, which tools it needs, any special instructions, and a category
2. After the user answers, call create_skill with the gathered info to save it
3. Confirm creation with the slash command they can use

## Guidelines
- Use specialist agents (ask_linear_agent, ask_gmail_agent, etc.) for service-specific requests — they can multi-step and have deeper domain knowledge
- Use direct API tools (list_linear_issues, search_gmail) for quick one-shot queries where you just need a list
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

  // Load tool permissions for this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partnerSettings } = await (supabase as any)
    .from("partner_settings")
    .select("tool_permissions")
    .eq("user_id", userId)
    .single();
  const toolPermissions: ToolPermissions | undefined = partnerSettings?.tool_permissions ?? undefined;

  // Extract last user text for auto-titling and analytics
  const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMsg
    ? ((lastUserMsg.parts as { type: string; text?: string }[]) ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join(" ")
    : "";

  // Load active MCP servers for this org and merge their tools
  let mcpTools: Record<string, unknown> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mcpServers } = await (adminDb as any)
      .from("mcp_servers")
      .select("url, api_key_encrypted, transport_type")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (mcpServers?.length) {
      const { connectMCPServer } = await import("@/lib/mcp/connect");
      const results = await Promise.allSettled(
        mcpServers.map((server: { url: string; api_key_encrypted: string | null; transport_type: "http" | "sse" }) =>
          connectMCPServer({
            url: server.url,
            apiKey: server.api_key_encrypted ?? undefined,
            transportType: server.transport_type,
          })
        )
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          Object.assign(mcpTools, result.value.tools);
        }
      }
    }
  } catch (err) {
    console.error("[chat] MCP server loading failed:", err);
  }

  const baseTools = createTools(supabase, orgId, clients, userId, toolPermissions);
  const allTools = { ...baseTools, ...mcpTools };

  // Load org-level rules for system prompt injection
  const orgRules = await loadRules(supabase, orgId);
  const rulesSection = formatRulesForPrompt(orgRules);

  // Inject real-time date/time into instructions
  const now = new Date();
  const dateTimeContext = `\n\n## Current Date & Time\nToday is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. The current time is ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}.\n`;

  // Derive model tier for tagging (e.g. "haiku" from "anthropic/claude-haiku-4-5-20251001")
  const modelTier = modelId.split("/").pop()?.split("-")[1] ?? "unknown";
  const toolNames = Object.keys(allTools);

  const agent = new ToolLoopAgent({
    model: gateway(modelId),
    instructions: AGENT_INSTRUCTIONS + dateTimeContext + rulesSection,
    tools: allTools,
    stopWhen: stepCountIs(20),
    providerOptions: {
      gateway: {
        user: userId,
        tags: [
          `model:${modelTier}`,
          `org:${orgId}`,
          ...toolNames.slice(0, 10).map((t) => `tool:${t}`),
        ],
      },
    },
    onStepFinish: ({ usage, toolCalls, text, providerMetadata }) => {
      // Capture gateway generation ID for observability
      const generationId = providerMetadata?.gateway?.generationId as string | undefined;
      if (generationId) {
        console.log(`[chat] gateway generationId=${generationId}`);
      }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalMessages: uiMessages as any,
    onFinish: async ({ messages: finalMessages }) => {
      // Persist the full conversation as UIMessage[] (complete with tool parts)
      // Delete existing messages for this conversation and re-save all
      if (conversationId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminDb as any)
          .from("chat_messages")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("org_id", orgId);

        const rows = finalMessages.map((msg: UIMessage) => ({
          org_id: orgId,
          user_id: userId,
          session_id: null,
          conversation_id: conversationId,
          role: msg.role,
          content: (msg.parts ?? []) as unknown as Json,
          model: msg.role === "assistant" ? modelId : null,
        }));

        if (rows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          void (adminDb as any)
            .from("chat_messages")
            .insert(rows)
            .then();
        }
      }
    },
  });

  // Attach rate limit headers to the streaming response
  const rlHeaders = rateLimitHeaders(rateLimitResult);
  for (const [key, value] of Object.entries(rlHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
