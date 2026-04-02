import { NextRequest } from "next/server";
import { ToolLoopAgent, createAgentUIStreamResponse, UIMessage, stepCountIs, pruneMessages, convertToModelMessages, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createTools, type ToolClients, type ToolPermissions } from "@/lib/ai/tools";
import { GranolaClient, LinearApiClient, NotionClient, GmailClient, DriveClient } from "@/lib/api";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { checkCredits, deductCredits, CREDIT_COSTS } from "@/lib/credits";
import { logUsage } from "@/lib/ai/usage";
import { loadRules, formatRulesForPrompt } from "@/lib/ai/priority-docs";
import { createCompactionMiddleware } from "@/lib/ai/compaction-middleware";
import { getContextWindow } from "@/lib/ai/token-counter";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

const ALLOWED_MODELS = new Set([
  // Flagship
  "anthropic/claude-opus-4.6",
  "openai/gpt-5.4",
  "google/gemini-3-pro",
  // Balanced
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.4-mini",
  "google/gemini-3-flash",
  // Fast
  "anthropic/claude-haiku-4.5",
  "google/gemini-3.1-flash-lite-preview", // legacy ID
  "openai/gpt-5-nano",
  "google/gemini-3.1-flash-lite-preview",
  // Legacy (in case old conversations reference these)
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "google/gemini-flash",
  "google/gemini-pro",
  "anthropic/claude-sonnet-4.5",
]);


function getVisualInstructions(level: string): string {
  if (level === "off") return "";
  const freqMap: Record<string, string> = {
    low: "VISUAL MODE: LOW — Only use inline HTML visuals when the user explicitly asks. Otherwise use plain text.",
    medium: "VISUAL MODE: MEDIUM — Use inline HTML visuals for structured data (metrics, people, status, comparisons, tables, diagrams). Use text for simple answers.",
    high: "VISUAL MODE: HIGH — Use inline HTML visuals generously. Explain concepts with diagrams, illustrate analogies, animate greetings, visualize thought processes. Be creative with HTML+CSS+SVG. Even simple explanations benefit from a small visual accent.",
  };
  const freq = freqMap[level] ?? freqMap.medium;
  return [
    "## CRITICAL: Inline Visuals FIRST — Always",
    "",
    "When displaying ANY visual content (charts, diagrams, people, data, status, comparisons, explanations), embed a ```html code block in your text. It renders as a rich interactive visual INLINE in the chat.",
    "",
    "NEVER use write_code, run_code, or run_project to display information. Those create heavy sandbox artifacts. Only use them when the user explicitly asks to BUILD a full app or RUN code.",
    "",
    "A chart? Inline. A diagram? Inline. A table? Inline. An org chart? Inline. A status dashboard? Inline. Only a full interactive React app needs the sandbox.",
    "",
    freq,
    "",
    "AVAILABLE LIBRARIES (loaded in every inline block — use freely with <script> tags):",
    "- **GSAP 3** (gsap): gsap.to(), gsap.from(), gsap.timeline() — best for smooth animations, staggered effects, morphing",
    "- **Chart.js 4** (Chart): new Chart(ctx, {type,data,options}) — bar, line, pie, doughnut, radar, polar. Use canvas element.",
    "- **anime.js 3** (anime): anime({targets, translateX, duration, easing}) — lightweight animation, SVG morphing, stagger",
    "- **Rough.js** (rough): rough.canvas(el).rectangle() — hand-drawn sketch style graphics on canvas",
    "- **Zdog** (Zdog): new Zdog.Illustration({element}) — cute pseudo-3D illustrations, shapes, animations",
    "- **canvas-confetti** (confetti): confetti({particleCount,spread,origin}) — celebration effects",
    "- **CSS @keyframes** — always available for pure CSS animations (pulse, glow, fade, slide, float, bounce)",
    "",
    "TIPS: Wrap library code in <script> tags. Give containers unique IDs.",
    "",
    "CHART.JS EXAMPLE (copy this pattern exactly for any chart):",
    "```html",
    "<div style='width:100%;height:400px'><canvas id='c1'></canvas></div>",
    "<script>",
    "new Chart(document.getElementById('c1'),{type:'bar',data:{labels:['A','B','C'],datasets:[{label:'Score',data:[85,92,78],backgroundColor:['#34d399','#10b981','#6ee7b7']}]},options:{responsive:true,maintainAspectRatio:false}});",
    "</script>",
    "```",
    "Set maintainAspectRatio:false and wrap canvas in a div with explicit height. Use mint colors for datasets.",
    "",
    "QUALITY RULES:",
    "- NO overlapping elements — use flexbox/grid, position properly",
    "- ALL text minimum 12px font-size, high contrast against dark background",
    "- Max height 500px per visual block",
    "- NO loading spinners or placeholders — render content immediately",
    "- Use GSAP or CSS @keyframes for entrance animations — make visuals feel alive",
    "- Charts: always set dark theme (background transparent, text #e5e7eb, grid rgba(255,255,255,0.06))",
    "",
    "STYLE GUIDE:",
    "- TRANSPARENT background always — body and all containers must be background:transparent or no background. The parent chat provides the dark background. NEVER set background-color on body or wrapper divs.",
    "- Colors: #e5e7eb (text), #9ca3af (secondary), #6b7280 (muted), #34d399 (mint accent), #10b981 (darker mint)",
    "- Subtle fills: rgba(52,211,153,0.08) mint tint, rgba(255,255,255,0.03) cards. NO solid bright backgrounds, NO gradients.",
    "- Borders: 1px solid rgba(255,255,255,0.06), border-radius 8-12px",
    "- Keep it FLUSH with the chat — no big wrapper boxes",
    "- Add polish: subtle shadows, hover transitions, gentle animations",
    "- NO emojis in HTML unless user asks",
  ].join("\n");
}

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
- ask_granola_agent — Delegate to Granola specialist for meeting transcript queries. NOTE: If MCP tools like list_meetings, get_meeting_transcript, or query_granola_meetings are available, PREFER those over ask_granola_agent — they connect directly to Granola via MCP OAuth.
- ask_drive_agent — Delegate to Drive specialist for file search and reading.

**MCP Tools (from connected external servers):**
You may have additional tools from MCP servers (like Granola, etc.). These are loaded dynamically. When both a built-in agent tool AND an MCP tool can handle a request, PREFER the MCP tool — it has a direct authenticated connection to the service.

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

**Inline Visual Content** — see instructions at the top of this prompt for frequency level and style guide.

You can embed multiple \`\`\`html blocks in one message. Text before, html block, more text, another html block — it all flows naturally.

ONLY use sandbox tools (run_project, run_code, write_code) when the user explicitly asks for:
- A full standalone app/project they can interact with
- Code execution that needs to run (scripts, APIs, computations)
- Something that needs npm packages, a build step, or live preview in an iframe

**Code & Sandbox:**
⚠️⚠️⚠️ STOP: If the user asked for a "chart", "diagram", "visual", "comparison", "graph", "table", or any data display — DO NOT use these tools. Use a \`\`\`html block with Chart.js/GSAP/SVG instead. These tools are ONLY for when the user says "build me an app", "run this code", "create a React project".
- write_code — code artifact with inline preview
- run_code — execute a SINGLE file in sandbox (scripts, computations)
- run_project — execute a MULTI-FILE project in sandbox (full React apps, npm projects)

CODE RULES:
- For React/JSX: Do NOT use run_code with raw JSX. Use run_project with template "react" or write_code with a SINGLE HTML file loading React from CDN.
- For Node.js scripts: use run_code with language "javascript" — write CommonJS (require), not ESM (import)
- For Python: use run_code with language "python"

**Compliance Review:**
- review_compliance — Check any content against ALL org rules and priority documents. Returns pass/fail for each rule with explanations. Use when asked to review, audit, or check content.

**Web:**
- web_search — search the web for current information via Perplexity. Use for recent events, facts, real-time data. Returns results with citations.
- web_browse — fetch and read a URL, extract text content.

**Repo Ingestion:**
- ingest_github_repo — Import a GitHub repo into the context library. Clones, reads key files, saves as searchable context.

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
- **Visual first**: Whenever showing structured data, people, metrics, status, or lists — use \`\`\`html blocks to render inline visuals. Don't describe things in markdown when you can show them as HTML.
- Use specialist agents (ask_linear_agent, ask_gmail_agent, etc.) for service-specific requests — they can multi-step and have deeper domain knowledge
- Use direct API tools (list_linear_issues, search_gmail) for quick one-shot queries where you just need a list
- Call search_context for general knowledge questions, meeting decisions, or cross-source queries
- Be concise and direct — lead with the answer, then explain
- Cite sources by name and date: [Source: title (date)]
- All write actions MUST go through the approval queue — never execute directly
- If a tool returns "not configured", tell the user to add their API key in Settings → API Keys
- Use review_compliance when asked to review/check/audit content against rules`;

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

  const requestedModel = body.model as string;
  const modelId = ALLOWED_MODELS.has(requestedModel)
    ? requestedModel
    : "google/gemini-3.1-flash-lite-preview";
  if (requestedModel !== modelId) {
    console.warn(`[chat] Model "${requestedModel}" not in ALLOWED_MODELS, falling back to ${modelId}`);
  }
  console.log(`[chat] Using model: ${modelId} (requested: ${requestedModel})`);

  const conversationId: string | null = (body.conversationId as string) ?? null;
  const visualLevel: string = (body.visualLevel as string) ?? "medium";

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
  let totalGatewayCost = 0;
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
  let mcpToolsList = ""; // For injecting into system prompt
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mcpServers } = await (adminDb as any)
      .from("mcp_servers")
      .select("name, url, api_key_encrypted, transport_type, discovered_tools")
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
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          Object.assign(mcpTools, result.value.tools);
        }
      }

      // Note: MCP tool definitions are already sent via the tools parameter.
      // We don't inject tool names into the system prompt to save tokens.
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

  // Derive model tier for observability logging
  const modelTier = modelId.split("/").pop()?.split("-")[1] ?? "unknown";

  // Wrap the model with compaction middleware to auto-summarize long conversations
  const baseModel = gateway(modelId);
  const compactedModel = wrapLanguageModel({
    model: baseModel,
    middleware: createCompactionMiddleware(getContextWindow(modelId)),
  });

  const agent = new ToolLoopAgent({
    model: compactedModel,
    instructions: getVisualInstructions(visualLevel) + AGENT_INSTRUCTIONS + dateTimeContext + rulesSection,
    tools: allTools,
    stopWhen: stepCountIs(20),
    // Note: providerOptions (gateway user/tags) are passed per-call, not on the agent.
    // TODO: pass via callOptions when ToolLoopAgent supports it.
    onStepFinish: ({ usage, toolCalls, text, providerMetadata }) => {
      // Capture gateway cost and generation ID for observability
      const gw = providerMetadata?.gateway as Record<string, unknown> | undefined;
      const generationId = gw?.generationId as string | undefined;
      const gatewayCost = gw?.cost as number | undefined;
      const gatewayMarketCost = gw?.marketCost as number | undefined;
      if (gatewayCost != null) totalGatewayCost += gatewayCost;
      if (generationId) {
        console.log(`[chat] gw=${generationId} cost=$${gatewayCost?.toFixed(6) ?? "?"} market=$${gatewayMarketCost?.toFixed(6) ?? "?"} model=${modelTier}`);
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
          gatewayCostUsd: totalGatewayCost > 0 ? totalGatewayCost : undefined,
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

      // Auto-title: generate a short title from user message + assistant response
      if (conversationId && lastUserText) {
        void (async () => {
          try {
            // Only title untitled conversations
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: conv } = await (adminDb as any)
              .from("conversations")
              .select("title")
              .eq("id", conversationId)
              .single();
            if (conv?.title) return;

            // Generate a concise title using a fast model
            const { generateText } = await import("ai");
            const { gateway } = await import("@ai-sdk/gateway");
            const { text: generatedTitle } = await generateText({
              model: gateway("google/gemini-3.1-flash-lite-preview"),
              prompt: `Generate a 3-6 word title for this conversation. No quotes, no punctuation at end. Just the title.\n\nUser: ${lastUserText.slice(0, 200)}`,
              maxOutputTokens: 20,
            });

            const title = generatedTitle.trim().slice(0, 80) || lastUserText.slice(0, 50);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
              .from("conversations")
              .update({ title, updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          } catch {
            // Fallback: use truncated user message
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
              .from("conversations")
              .update({ title: lastUserText.slice(0, 50), updated_at: new Date().toISOString() })
              .eq("id", conversationId)
              .is("title", null);
          }
        })();
      }
    },
  });

  // Prune old tool calls and reasoning to save tokens on long conversations
  const modelMessages = await convertToModelMessages(uiMessages);
  const prunedMessages = pruneMessages({
    messages: modelMessages,
    reasoning: "before-last-message",         // keep only latest reasoning
    toolCalls: "before-last-2-messages",      // keep tool calls from last 2 turns only
    emptyMessages: "remove",                  // remove empty messages
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
