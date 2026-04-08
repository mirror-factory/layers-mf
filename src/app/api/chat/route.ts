import { NextRequest } from "next/server";
import { ToolLoopAgent, createAgentUIStreamResponse, UIMessage, stepCountIs, pruneMessages, convertToModelMessages, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/ai/tools";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { checkCredits, deductCredits, CREDIT_COSTS } from "@/lib/credits";
import { logUsage } from "@/lib/ai/usage";
import { loadPersonalRules, loadOrgRules, formatRulesForPrompt, formatOrgRulesForPrompt } from "@/lib/ai/priority-docs";
import { createCompactionMiddleware } from "@/lib/ai/compaction-middleware";
import { getContextWindow } from "@/lib/ai/token-counter";
import { createHash } from "crypto";
import type { Json } from "@/lib/database.types";

// Sandbox builds (npm install + Vite compilation + health check) can take 90+ seconds.
// 60s was too short and caused silent timeouts. 180s covers the worst case.
export const maxDuration = 180;

// ── System prompt cache (in-memory, 5-min TTL) ──
const systemPromptCache = new Map<string, { prompt: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedSystemPrompt(key: string): string | null {
  const entry = systemPromptCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    systemPromptCache.delete(key);
    return null;
  }
  return entry.prompt;
}

function setCachedSystemPrompt(key: string, prompt: string): void {
  // Evict expired entries periodically (keep cache bounded)
  if (systemPromptCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of systemPromptCache) {
      if (now > v.expiresAt) systemPromptCache.delete(k);
    }
  }
  systemPromptCache.set(key, { prompt, expiresAt: Date.now() + CACHE_TTL_MS });
}

const ALLOWED_MODELS = new Set([
  // Flagship
  "anthropic/claude-opus-4.6",
  "openai/gpt-5.4",
  "google/gemini-3.1-pro-preview",
  // Balanced
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.4-mini",
  "google/gemini-3-flash",
  // Fast
  "anthropic/claude-haiku-4.5",
  "google/gemini-3.1-flash-lite-preview", // legacy ID
  "openai/gpt-5-nano",
  "google/gemini-3.1-flash-lite-preview",
  // Local (Ollama — dev only, requires Ollama running on localhost:11434)
  // Any ollama/ prefix model is accepted via isOllamaModel() check
  "ollama/qwen3:8b",
  "ollama/gemma4:26b",
  "ollama/qwen3.5:27b",
  "ollama/llama3.2-vision:11b",
  // Legacy (in case old conversations reference these)
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "google/gemini-flash",
  "google/gemini-pro",
  "anthropic/claude-sonnet-4.5",
]);

/** Check if a model ID is a local Ollama model */
function isOllamaModel(modelId: string): boolean {
  return modelId.startsWith("ollama/");
}


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

## Response Quality Standards
- Write PRODUCTION-QUALITY code — complete, polished, well-structured. Never generate placeholder stubs or "TODO" comments.
- When generating code files: write the FULL implementation. Don't truncate, abbreviate, or leave sections incomplete. You have up to 128K output tokens — use what you need.
- When creating documents: write thorough, detailed content with proper structure. Don't write skeleton outlines — write complete documents.
- When answering questions: be comprehensive with context, examples, and actionable next steps.
- Match the effort to the ask. A simple question gets a concise answer. A "build me an app" request gets a complete, styled, functional application.

## Design & UI/UX Standards (ALWAYS follow when building apps)
When creating ANY visual application — sandbox apps, HTML pages, or UI components — follow these design principles:

**Visual Design:**
- Use a cohesive color palette — choose 2-3 primary colors + neutrals. Never use default browser colors.
- Apply consistent spacing: use a 4px/8px grid system. Padding, margins, gaps should be multiples of 4.
- Typography hierarchy: clear distinction between headings (bold, larger), body text, and captions. Use system fonts or Google Fonts.
- Add subtle shadows (box-shadow: 0 1px 3px rgba(0,0,0,0.1)), rounded corners (border-radius: 8-12px), and smooth transitions (transition: all 0.2s ease).
- Dark/light mode support when appropriate. Use CSS custom properties for theme colors.
- Micro-interactions: hover effects on buttons (scale, color shift), focus states, active/pressed states. Buttons should feel clickable.

**Layout & Responsive Design:**
- Mobile-first: design for 375px width, then scale up. Use flexbox or CSS grid, not fixed widths.
- Max content width: 1200px centered. Don't let text lines exceed 70 characters.
- Responsive breakpoints: 640px (mobile), 768px (tablet), 1024px (desktop).
- Proper spacing between sections. White space is a feature, not a bug.

**Component Patterns:**
- Buttons: padding 10-14px vertical, 20-28px horizontal. Clear hover/active states. Primary (filled), Secondary (outline), Ghost (text-only).
- Inputs: visible borders, focus rings, placeholder text, proper height (40-44px).
- Cards: subtle border or shadow, padding 16-24px, rounded corners.
- Lists: consistent spacing, dividers or alternating backgrounds.
- Modals/dialogs: backdrop overlay, centered content, close button, escape key handler.
- Loading states: skeleton screens or spinners, never blank screens.
- Error states: clear error messages with recovery actions, not just "Error".

**Accessibility:**
- All interactive elements must be keyboard accessible (tab order, Enter/Space activation).
- Color contrast: 4.5:1 minimum for text. Don't rely on color alone for meaning.
- Form labels: every input needs a visible label or aria-label.
- Focus indicators: visible focus rings on all interactive elements.
- Semantic HTML: use <button>, <nav>, <main>, <header>, <section> — not div for everything.

**Animation & Motion:**
- Use CSS transitions for hover/focus (0.15-0.3s ease).
- Page transitions: subtle fade or slide (not jarring).
- Loading animations: pulse, spin, or skeleton shimmer.
- Don't animate layout shifts — use transform and opacity only for smooth 60fps.

**Code Quality for Apps:**
- Separate concerns: App.jsx for logic/structure, App.css for ALL styling. Don't use inline styles for complex layouts.
- CSS organization: group by component sections with clear comments. Use class names, not element selectors.
- State management: useState for local, useReducer for complex. Derive state when possible.
- Event handlers: proper naming (handleClick, handleSubmit). Prevent default on forms.
- Component structure: extract reusable components when patterns repeat 3+ times.

## Sandbox & Project Architecture
**React/Vite apps (template: "react"):**
- Template provides: package.json, vite.config.js, index.html, src/main.jsx, src/index.css
- You provide: src/App.jsx + src/App.css (minimum). Add component files as needed.
- Port 5173 (auto-detected). Dev server: "npm run dev".
- ALL React files MUST use .jsx extension (not .js). Vite crashes on .js with JSX.
- Include EVERY file you import. If App.jsx imports './App.css', App.css MUST be in the files array.

**Next.js apps (template: "nextjs") — USE FOR AI-POWERED APPS:**
- Template provides: package.json (with ai, @ai-sdk/react, @ai-sdk/gateway), app/layout.jsx, app/api/chat/route.js
- You provide: app/page.jsx + any additional routes/components.
- Port 3000 (auto-detected). Dev server: "next dev -H 0.0.0.0 -p 3000".
- Supports API routes, server components, useChat, streamText — full Next.js App Router.
- AI_GATEWAY_API_KEY is automatically available as env var in the sandbox.
- Call ai_sdk_reference("sandbox-ai-app") BEFORE writing any AI app code.

**Persistent sandboxes:**
- Each org gets a named sandbox that persists across sessions.
- First build: npm install (~12s) + dev server start (~3s). Total ~15s.
- Subsequent builds: deps cached, just write files + start server (~5s).
- After edit_code: sandbox auto-restarts with updated files. Live preview refreshes.
- Sandbox URLs stay alive and auto-resume when visited.

## Your Tools
You have these tools available — use the RIGHT tool for the job:

**Knowledge Search (searches Supabase context library):**
- search_context — search documents, meetings, notes in the knowledge base
- get_document — fetch full content of a specific document by ID

**IMPORTANT — Tool Priority:**
1. ALWAYS search the local knowledge base FIRST using search_context when the user asks about documents, files, notes, or anything that could be in their library.
2. Only use MCP tools (external services) AFTER checking the local library, or when the user explicitly asks about a specific external service (e.g., "check my Canva", "search Gmail").
3. The user's uploaded documents, meeting notes, and synced content are ALL in the local knowledge base — search_context finds them.

**MCP Tools (from connected external servers):**
You may have additional tools from MCP servers (like Canva, Granola, etc.). These are loaded dynamically. Use them for service-specific requests — they have direct authenticated connections. But ALWAYS check search_context first for document/file lookups.

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
***STOP*** If the user asked for a "chart", "diagram", "visual", "comparison", "graph", "table", or any data display — DO NOT use these tools. Use a \`\`\`html block with Chart.js/GSAP/SVG instead. These tools are ONLY for when the user says "build me an app", "run this code", "create a React project".
- write_code — save a code file as an artifact. Use for: single HTML pages, standalone scripts, simple web pages, any single-file code. FAST, no sandbox needed.
- run_code — execute a SINGLE file in sandbox (scripts, computations). For code that needs to RUN and produce output.
- run_project — execute a MULTI-FILE project in sandbox (full React apps, npm projects). SLOW (60-90s for fresh builds). Only use when the user needs a full interactive app with npm packages and a dev server.

TOOL SELECTION RULES:
- "make a webpage/HTML page" → use write_code with an HTML file (NOT run_project — that's overkill for a static page)
- "build an app/React app" → use run_project with template "react"
- "run this script" → use run_code
- "edit the title/content of this document" → use edit_document (NOT propose_action)
- For React/JSX: Do NOT use run_code with raw JSX. Use run_project with template "react" or write_code with a SINGLE HTML file loading React from CDN.
- For Node.js scripts: use run_code with language "javascript" — write CommonJS (require), not ESM (import)
- For Python: use run_code with language "python"

**AI SDK Reference:**
- ai_sdk_reference — Look up Vercel AI SDK patterns BEFORE writing any AI-powered code. Use topic "sandbox-ai-app" for Vite sandbox apps (no server), "chat-client"/"chat-server" for Next.js apps.
- IMPORTANT: For AI-powered apps, use template "nextjs" (NOT "react/vite"). Next.js runs fully in the sandbox with API routes, useChat, and streamText. Call ai_sdk_reference("sandbox-ai-app") first to get the patterns.

CRITICAL — ARTIFACT FILE RULES (run_project):
- ALWAYS use .jsx extension for files with JSX/React (NOT .js). Vite will crash on .js with JSX.
- If you import a CSS file (import './App.css'), you MUST include that CSS file in the files array. Missing files = build error.
- Include ALL files the app needs. Don't reference files you didn't create.
- Use inline styles OR include a CSS file — pick one, don't mix and miss.
- When using template "react", you only need to provide: src/App.jsx (+ src/App.css if you want styles). Template auto-generates package.json, vite.config, index.html, main.jsx.

EDITING EXISTING ARTIFACTS — NEVER recreate when you can edit:
- If an artifact already exists and the user wants changes, use edit_code (for code/sandbox) or edit_document (for docs).
- edit_code takes an artifactId + targetText + replacement. For multi-file projects, also pass filePath (e.g. "src/App.jsx").
- Do NOT call run_project again to fix a bug or make a change — use edit_code on the existing artifact, then the user can click "Restart" to recompile.
- Only create a new artifact (run_project) if the user explicitly asks for a NEW project or the existing one is fundamentally broken beyond editing.

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
- search_mcp_servers — search MCP registries (official, Smithery, curated) for tool servers to connect. Use when the user wants to add integrations.
- connect_mcp_server — add an MCP server to the user's connected tools. Works with registry results OR direct URLs pasted by the user. Returns an inline OAuth button or API key input for the user to complete setup right in chat.
- disconnect_mcp_server — remove an MCP server by name. Use when the user wants to disconnect or uninstall a tool.
- list_mcp_servers — show all connected MCP servers with status, auth type, and available tools.

When the user asks to connect a tool, integration, or MCP server:
1. If they provide a URL directly, use connect_mcp_server immediately (derive name from domain)
2. If they describe what they need, use search_mcp_servers to find options
3. Present the results and let the user choose
4. Use connect_mcp_server for the chosen server
5. The UI will render a "Connect with OAuth" or "Enter API Key" button automatically

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
- /schedule → list scheduled actions (tell user to visit /schedules page to manage them)
- /approve → call list_approvals (NOT search_context)
- /search [query] → call web_search
- /skill create → start a skill creation interview using ask_user, then call create_skill

## Skill Creation Flow
When the user wants to create a skill (via "/skill create" or similar):
1. Call ask_user with questions about the skill: name, what it does, which tools it needs, any special instructions, and a category
2. After the user answers, call create_skill with the gathered info to save it
3. Confirm creation with the slash command they can use

## Avatar Emotions
You can express emotions through your animated avatar by including an emotion marker in your text. The avatar will briefly animate to show the emotion (3 seconds default), then return to normal.

Format: [emotion:name] or [emotion:name:seconds]

Available emotions: happy, joy, excited, celebration, success, thinking, curious, love, concern, sorry, confident, creative, focused, calm, greeting, ready, analyzing, surprise

Examples:
- "Great news! [emotion:celebration] Your deployment succeeded."
- "[emotion:greeting] Hello Alfonso! How can I help today?"
- "I understand the concern. [emotion:concern] Let me look into that."
- "[emotion:thinking] That's an interesting question..."

Use emotions naturally — they make conversations feel alive. Don't overuse them.

## Handling Skipped Questions
When ask_user returns { "_skipped": true }, the user chose to skip your questions. Handle this gracefully:
- Acknowledge the skip briefly: "No problem, I'll proceed without that."
- Continue with reasonable defaults or the information you already have.
- Do NOT re-ask the same questions. Move forward with your best judgment.
- Keep the acknowledgment to one short sentence, then proceed with the task.

## Guidelines
- **Visual first**: Whenever showing structured data, people, metrics, status, or lists — use \`\`\`html blocks to render inline visuals. Don't describe things in markdown when you can show them as HTML.
- Use MCP tools for service-specific requests (Linear, Gmail, Notion, etc.) — they have direct authenticated connections
- Call search_context for general knowledge questions, meeting decisions, or cross-source queries
- Be concise and direct — lead with the answer, then explain
- Cite sources by name and date: [Source: title (date)]
- All write actions MUST go through the approval queue — never execute directly
- If a tool returns "not configured", tell the user to add their API key in Settings → API Keys
- Use review_compliance when asked to review/check/audit content against rules`;

export async function POST(request: NextRequest) {
  const _t = Date.now();
  const _log = (label: string) => console.log(`[chat-timing] ${Date.now() - _t}ms | ${label}`);

  const supabase = await createClient();
  _log("supabase client created");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  _log("auth checked");
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  _log("org member resolved");

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

  // Model comes from header (dynamic ref) with body fallback
  const requestedModel = request.headers.get("x-model") || (body.model as string) || "google/gemini-3.1-flash-lite-preview";
  // Accept any ollama/ prefixed model (local dev) + cloud models from allowed list
  const modelId = (ALLOWED_MODELS.has(requestedModel) || requestedModel.startsWith("ollama/"))
    ? requestedModel
    : "google/gemini-3.1-flash-lite-preview";
  if (requestedModel !== modelId) {
    console.warn(`[chat] Model "${requestedModel}" not in ALLOWED_MODELS, falling back to ${modelId}`);
  }
  const conversationId: string | null = (body.conversationId as string) ?? null;
  const visualLevel: string = (body.visualLevel as string) ?? "medium";
  const activeArtifactId: string | null = request.headers.get("x-artifact-id") || null;
  const activeFilePath: string | null = request.headers.get("x-artifact-file") || null;

  const t0 = Date.now();
  const isLocal = isOllamaModel(modelId);
  console.log(`[chat] START | model=${modelId} | local=${isLocal} | conv=${conversationId ?? "new"}`);

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
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalGatewayCost = 0;
  let runStepCount = 0;
  let assistantText = "";

  interface StepStats {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
    durationMs: number;
    toolCalls: string[];
  }
  const stepStats: StepStats[] = [];
  let stepStartTime = Date.now();

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

  // Extract last user text for auto-titling and analytics
  const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMsg
    ? ((lastUserMsg.parts as { type: string; text?: string }[]) ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join(" ")
    : "";

  // Load active MCP servers for this org and merge their tools via ConnectionManager
  // Skip for local models — MCP connections are slow and unnecessary for simple local chat
  let mcpTools: Record<string, unknown> = {};
  if (isLocal) {
    console.log(`[chat] Skipping MCP/credentials/rules for local model (${Date.now() - t0}ms)`);
  }
  try {
    if (isLocal) throw new Error("skip-local");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mcpServers } = await (adminDb as any)
      .from("mcp_servers")
      .select("id, name, url, api_key_encrypted, transport_type, auth_type, oauth_refresh_token, oauth_expires_at, oauth_token_url, oauth_client_id, oauth_client_secret, discovered_tools")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (mcpServers?.length) {
      console.log(`[chat] Loading ${mcpServers.length} MCP server(s): ${mcpServers.map((s: { name: string }) => s.name).join(", ")}`);
      const { getConnection, ensureAuth } = await import("@/lib/mcp/connection-manager");

      const results = await Promise.allSettled(
        mcpServers.map(async (server: {
          id: string;
          name: string;
          url: string;
          api_key_encrypted: string | null;
          transport_type: "http" | "sse";
          auth_type?: string;
          oauth_refresh_token?: string;
          oauth_expires_at?: string;
          oauth_token_url?: string;
          oauth_client_id?: string;
          oauth_client_secret?: string;
          discovered_tools?: { name: string }[];
        }) => {
          // Refresh expired OAuth tokens before connecting
          const authResult = await ensureAuth({
            authType: (server.auth_type as "bearer" | "oauth" | "none") ?? "none",
            apiKey: server.api_key_encrypted ?? undefined,
            oauthRefreshToken: server.oauth_refresh_token,
            oauthExpiresAt: server.oauth_expires_at,
            tokenUrl: server.oauth_token_url,
            clientId: server.oauth_client_id,
            clientSecret: server.oauth_client_secret,
          });

          // Persist refreshed tokens back to DB
          if (authResult.refreshed && authResult.newTokens) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
              .from("mcp_servers")
              .update({
                api_key_encrypted: authResult.newTokens.accessToken,
                oauth_refresh_token: authResult.newTokens.refreshToken,
                oauth_expires_at: authResult.newTokens.expiresAt,
              })
              .eq("id", server.id);
          }

          return getConnection({
            serverId: server.id,
            url: server.url,
            apiKey: authResult.apiKey,
            transportType: server.transport_type,
            authType: (server.auth_type as "bearer" | "oauth" | "none") ?? undefined,
          });
        })
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const server = mcpServers[i];
        if (result.status === "fulfilled") {
          const toolNames = Object.keys(result.value.tools);
          console.log(`[chat] MCP "${server.name}" loaded ${toolNames.length} tools: ${toolNames.slice(0, 5).join(", ")}${toolNames.length > 5 ? "..." : ""}`);
          Object.assign(mcpTools, result.value.tools);
        } else {
          console.error(`[chat] MCP "${server.name}" failed to connect:`, result.reason?.message ?? result.reason);
          // Mark server as having an error so user sees it in the UI
          await (adminDb as any)
            .from("mcp_servers")
            .update({ error_message: result.reason?.message?.slice(0, 200) ?? "Connection failed" })
            .eq("id", server.id);
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message !== "skip-local") {
      console.error("[chat] MCP server loading failed:", err);
    }
  }

  console.log(`[chat] ${Date.now() - t0}ms | tools created`);

  const baseTools = createTools(supabase, orgId, userId);
  const allTools = { ...baseTools, ...mcpTools };

  let fullInstructions: string;

  if (isLocal) {
    // LOCAL MODEL: skip rules, skip prompt cache, skip artifact context — go fast
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    fullInstructions = `You are Granger, an AI assistant. Be helpful and concise. Today is ${dateStr}.`;
    console.log(`[chat] ${Date.now() - t0}ms | local model — slim prompt ready`);
  } else {
    // CLOUD MODEL: full pipeline — rules, visual instructions, artifact context
    const [personalRules, orgScopeRules] = await Promise.all([
      loadPersonalRules(supabase, orgId),
      loadOrgRules(supabase, orgId),
    ]);
    const rulesSection = formatRulesForPrompt(personalRules) + formatOrgRulesForPrompt(orgScopeRules);
    const rulesHash = createHash("md5").update(rulesSection + visualLevel).digest("hex");
    const cacheKey = `${orgId}:${rulesHash}`;

    let instructions = getCachedSystemPrompt(cacheKey);
    if (!instructions) {
      instructions = getVisualInstructions(visualLevel) + AGENT_INSTRUCTIONS + rulesSection;
      setCachedSystemPrompt(cacheKey, instructions);
      console.log("[chat] System prompt cache MISS — assembled and cached");
    } else {
      console.log("[chat] System prompt cache HIT");
    }

    const now = new Date();
    const dateTimeContext = `\n\n## Current Date & Time\nToday is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })}. The current time is ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })}.\n`;

    let artifactContext = "";
    if (activeArtifactId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data: artifact } = await sb
          .from("artifacts")
          .select("id, title, type, language, current_version, content, framework, run_command, expose_port")
          .eq("id", activeArtifactId)
          .single();

        if (artifact) {
          const { data: artFiles } = await sb
            .from("artifact_files")
            .select("file_path, language")
            .eq("artifact_id", activeArtifactId)
            .eq("version_number", artifact.current_version);

          const fileList = artFiles?.map((f: { file_path: string }) => f.file_path) ?? [];
          artifactContext = `\n\n## Active Artifact (currently open in side panel)\n` +
            `- ID: ${artifact.id}\n` +
            `- Title: ${artifact.title}\n` +
            `- Type: ${artifact.type} | Language: ${artifact.language ?? "unknown"} | Version: v${artifact.current_version}\n` +
            (fileList.length > 0 ? `- Files: ${fileList.join(", ")}\n` : "") +
            (activeFilePath ? `- Currently viewing: ${activeFilePath}\n` : "") +
            `\nWhen the user asks to edit, change, or modify this artifact, use edit_code with artifactId="${artifact.id}"` +
            (activeFilePath ? ` and filePath="${activeFilePath}"` : "") +
            `. Do NOT create a new artifact.\n`;
        }
      } catch {
        // Artifact lookup failed — continue without context
      }
    }

    fullInstructions = instructions + dateTimeContext + artifactContext;
    console.log(`[chat] ${Date.now() - t0}ms | cloud model — full prompt ready`);
  }

  // Derive model tier for observability logging
  const modelTier = modelId.split("/").pop()?.split("-")[1] ?? "unknown";

  // Select model: Ollama for local models, AI Gateway for cloud models
  let baseModel;
  if (isLocal) {
    const { ollama } = await import("ollama-ai-provider-v2");
    const { warmupOllama } = await import("@/lib/ai/ollama-warmup");
    const ollamaModelName = modelId.replace("ollama/", "");
    // Ensure model stays in GPU memory (fire-and-forget on first call)
    void warmupOllama(ollamaModelName);
    baseModel = ollama(ollamaModelName);
  } else {
    baseModel = gateway(modelId);
  }
  _log("model created");
  // Skip compaction middleware for local models (smaller context, simpler pipeline)
  const compactedModel = isLocal ? baseModel : wrapLanguageModel({
    model: baseModel,
    middleware: createCompactionMiddleware(getContextWindow(modelId)),
  });
  _log("middleware applied");

  const agent = new ToolLoopAgent({
    model: compactedModel,
    instructions: fullInstructions,
    tools: allTools,
    // Local models: smaller output cap. Cloud: max out.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prepareStep: () => ({
      maxOutputTokens: isLocal ? 4096 : 128000,
      providerOptions: isLocal ? {} : {
        gateway: { caching: "auto" },
      },
    } as any),
    stopWhen: stepCountIs(isLocal ? 5 : 20),
    // Note: providerOptions (gateway user/tags) are passed per-call, not on the agent.
    // TODO: pass via callOptions when ToolLoopAgent supports it.
    onStepFinish: ({ usage, toolCalls, text, providerMetadata }) => {
      const stepDuration = Date.now() - stepStartTime;
      stepStartTime = Date.now();

      // Capture gateway cost and generation ID for observability
      const gw = providerMetadata?.gateway as Record<string, unknown> | undefined;
      const generationId = gw?.generationId as string | undefined;
      const gatewayCost = gw?.cost as number | undefined;
      const gatewayMarketCost = gw?.marketCost as number | undefined;
      if (gatewayCost != null) totalGatewayCost += gatewayCost;
      if (generationId) {
        console.log(`[chat] gw=${generationId} cost=$${gatewayCost?.toFixed(6) ?? "?"} market=$${gatewayMarketCost?.toFixed(6) ?? "?"} model=${modelTier}`);
      }

      // Cache stats from usage details
      const cacheRead = (usage as { inputTokenDetails?: { cacheReadTokens?: number } })?.inputTokenDetails?.cacheReadTokens ?? 0;
      const cacheWrite = (usage as { inputTokenDetails?: { cacheWriteTokens?: number } })?.inputTokenDetails?.cacheWriteTokens ?? 0;
      totalCacheReadTokens += cacheRead;
      totalCacheWriteTokens += cacheWrite;
      if (cacheRead > 0 || cacheWrite > 0) {
        console.log(`[chat] cache: read=${cacheRead} write=${cacheWrite}`);
      }

      runStepCount++;
      if (text) assistantText += text;

      const stepInput = usage?.inputTokens ?? 0;
      const stepOutput = usage?.outputTokens ?? 0;
      if (usage) {
        totalInputTokens += stepInput;
        totalOutputTokens += stepOutput;
      }

      const stepToolNames: string[] = [];
      if (toolCalls) {
        for (const tc of toolCalls) {
          const name = tc.toolName ?? "unknown";
          toolCallCounts[name] = (toolCallCounts[name] ?? 0) + 1;
          stepToolNames.push(name);
        }
      }

      stepStats.push({
        model: modelId,
        inputTokens: stepInput,
        outputTokens: stepOutput,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        costUsd: gatewayCost ?? 0,
        durationMs: stepDuration,
        toolCalls: stepToolNames,
      });
    },
    onFinish: () => {
      // === CHAT SUMMARY LOG ===
      const durationMs = Date.now() - startTime;
      const toolsUsed = Object.entries(toolCallCounts).map(([t, c]) => `${t}(${c})`).join(", ") || "none";
      console.log(
        `[chat] [OK] DONE | model=${modelId} | steps=${runStepCount} | ` +
        `in=${totalInputTokens} out=${totalOutputTokens} total=${totalInputTokens + totalOutputTokens} | ` +
        `cost=$${totalGatewayCost.toFixed(4)} | ${(durationMs / 1000).toFixed(1)}s | ` +
        `tools=[${toolsUsed}] | response=${assistantText.length}chars`
      );

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

      // agent_run insert happens in createAgentUIStreamResponse onFinish (below)
      // to avoid duplicate inserts

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
            console.log("[chat] Auto-title: generating for conv=" + conversationId);
            // Only title untitled conversations
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: conv } = await (adminDb as any)
              .from("conversations")
              .select("title")
              .eq("id", conversationId)
              .single();
            if (conv?.title) {
              console.log("[chat] Auto-title: skipped, already titled conv=" + conversationId);
              return;
            }

            // Generate a concise title using a fast model
            const { generateText } = await import("ai");
            const { gateway } = await import("@ai-sdk/gateway");
            const { text: generatedTitle } = await generateText({
              model: gateway("google/gemini-3.1-flash-lite-preview"),
              prompt: `Generate a 3-6 word title for this conversation. No quotes, no punctuation at end. Just the title.\n\nUser: ${lastUserText.slice(0, 200)}`,
              maxOutputTokens: 20,
            });

            const title = generatedTitle.trim().slice(0, 80) || lastUserText.slice(0, 50);
            console.log("[chat] Auto-title: generated title=\"" + title + "\" for conv=" + conversationId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
              .from("conversations")
              .update({ title, updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          } catch (err) {
            console.error("[chat] Auto-title: error for conv=" + conversationId, err);
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

  _log("agent created");

  // Prune old tool calls and reasoning to save tokens on long conversations
  const modelMessages = await convertToModelMessages(uiMessages);
  _log("messages converted");
  const prunedMessages = pruneMessages({
    messages: modelMessages,
    reasoning: "before-last-message",         // keep only latest reasoning
    toolCalls: "before-last-2-messages",      // keep tool calls from last 2 turns only
    emptyMessages: "remove",                  // remove empty messages
  });
  _log("messages pruned — starting stream");

  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalMessages: uiMessages as any,
    onFinish: async ({ messages: finalMessages }) => {
      // Persist the full conversation as UIMessage[] (complete with tool parts)
      // Delete existing messages for this conversation and re-save all
      if (conversationId) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: deleteError } = await (adminDb as any)
            .from("chat_messages")
            .delete()
            .eq("conversation_id", conversationId)
            .eq("org_id", orgId);

          if (deleteError) {
            console.error("[chat] Failed to delete old messages:", deleteError.message);
          }

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
            const { error: insertError } = await (adminDb as any)
              .from("chat_messages")
              .insert(rows);

            if (insertError) {
              console.error("[chat] Failed to save messages:", insertError.message, `(${rows.length} rows, conv=${conversationId})`);
            } else {
              console.log(`[chat] Saved ${rows.length} messages to conv=${conversationId}`);
            }
          }
        } catch (err) {
          console.error("[chat] Chat persistence error:", err);
        }
      }

      // Save agent run stats (backup — also attempted in agent onFinish)
      if (conversationId && totalInputTokens > 0) {
        try {
          const toolCallsArr = Object.entries(toolCallCounts).map(([tool, count]) => ({ tool, count }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: runErr } = await (adminDb as any)
            .from("agent_runs")
            .insert({
              org_id: orgId,
              user_id: userId,
              model: modelId,
              query: query.slice(0, 500),
              step_count: runStepCount,
              finish_reason: "stop",
              total_input_tokens: totalInputTokens,
              total_output_tokens: totalOutputTokens,
              cache_read_tokens: totalCacheReadTokens ?? 0,
              cache_write_tokens: totalCacheWriteTokens ?? 0,
              duration_ms: Date.now() - startTime,
              tool_calls: toolCallsArr,
              gateway_cost_usd: totalGatewayCost > 0 ? totalGatewayCost : 0,
              conversation_id: conversationId,
              step_details: stepStats.length > 0 ? stepStats : null,
              error: null,
            });
          if (runErr) {
            console.error("[chat] agent_run insert failed:", runErr.message);
          } else {
            console.log(`[chat] agent_run saved: conv=${conversationId} model=${modelId} dur=${Date.now() - startTime}ms`);
          }
        } catch (err) {
          console.error("[chat] agent_run error:", err);
        }
      }

      // Auto-title untitled conversations (runs in stream onFinish which reliably fires)
      if (conversationId && lastUserText) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: conv } = await (adminDb as any)
            .from("conversations")
            .select("title")
            .eq("id", conversationId)
            .single();

          if (!conv?.title) {
            const { generateText: genTitle } = await import("ai");
            const { gateway: gw } = await import("@ai-sdk/gateway");
            const { text: generatedTitle } = await genTitle({
              model: gw("google/gemini-3.1-flash-lite-preview"),
              prompt: `Generate a 3-6 word title for this conversation. No quotes, no punctuation at end. Just the title.\n\nUser: ${lastUserText.slice(0, 200)}`,
              maxOutputTokens: 20,
            });
            const title = generatedTitle.trim().slice(0, 80) || lastUserText.slice(0, 50);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
              .from("conversations")
              .update({ title, updated_at: new Date().toISOString() })
              .eq("id", conversationId);
            console.log(`[chat] Auto-titled: "${title}" for conv=${conversationId}`);
          }
        } catch (err) {
          // Fallback: use truncated user message
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (adminDb as any)
              .from("conversations")
              .update({ title: lastUserText.slice(0, 50), updated_at: new Date().toISOString() })
              .eq("id", conversationId)
              .is("title", null);
          } catch { /* silent */ }
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
