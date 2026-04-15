import { createGateway } from "@ai-sdk/gateway";

// All models route through Vercel AI Gateway (AI_GATEWAY_API_KEY)
// No per-provider API keys needed. Single key routes to any provider.
export const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });

// === Model Matrix (March 2026) ===
// 9 models across 3 providers × 3 tiers
export const MODEL_MATRIX = {
  flagship: {
    claude: "anthropic/claude-opus-4.6",           // Deep reasoning, synthesis — 128K output
    openai: "openai/gpt-5.4",                      // Complex analysis — 128K output
    gemini: "google/gemini-3.1-pro-preview",       // Multimodal, long context — 65K output
  },
  balanced: {
    claude: "anthropic/claude-sonnet-4.6",         // Chat, extraction — 64K output
    openai: "openai/gpt-5.4-mini",                // Fast balanced — 128K output
    gemini: "google/gemini-3-flash",               // Fast multimodal — 65K output
  },
  fast: {
    claude: "anthropic/claude-haiku-4.5",          // Ingestion, classification — 64K output
    openai: "openai/gpt-5-nano",                  // Ultra-fast, cheap
    gemini: "google/gemini-3.1-flash-lite-preview", // Cheapest — 65K output
  },
} as const;

// Flat set of all allowed model IDs (for chat route validation)
export const ALLOWED_MODELS = new Set(
  Object.values(MODEL_MATRIX).flatMap(tier => Object.values(tier))
);

// === Task-to-Model Defaults ===
// Each task uses the most cost-effective model for its complexity
export const TASK_MODELS = {
  chat: MODEL_MATRIX.balanced.claude,         // User-facing conversations
  extraction: MODEL_MATRIX.balanced.claude,   // Document entity extraction
  classification: MODEL_MATRIX.fast.claude,   // Ingestion, routing
  digest: MODEL_MATRIX.balanced.claude,       // Morning digest generation
  compaction: MODEL_MATRIX.fast.claude,       // History summarization
  synthesis: MODEL_MATRIX.flagship.claude,    // Nightly 30-day review
  taskSync: MODEL_MATRIX.fast.claude,         // Linear/task sync
  subagent: MODEL_MATRIX.balanced.claude,     // Sub-agent delegation
  embedding: "openai/text-embedding-3-small",  // 1536-dim — must match DB vector(1536) column
  embeddingFallback: "google/text-embedding-005", // 768-dim — NOT compatible with DB, only for future migration
} as const;

// Pre-built model instances for common use
export const extractionModel = gateway(TASK_MODELS.extraction);
export const embeddingModel = gateway.textEmbeddingModel(TASK_MODELS.embedding);

// Dev-only Claude Code models
if (process.env.NODE_ENV === "development") {
  ALLOWED_MODELS.add("claude-code/opus");
  ALLOWED_MODELS.add("claude-code/sonnet");
  ALLOWED_MODELS.add("claude-code/haiku");
}

// Dev-only: Claude Code provider (uses CLI auth, no API key needed)
// Install: pnpm add ai-sdk-provider-claude-code
// Auth: claude auth login (via Claude Code CLI)
let claudeCodeModel: ((tier: "opus" | "sonnet" | "haiku") => ReturnType<typeof gateway>) | null = null;
try {
  if (process.env.NODE_ENV === "development") {
    // Dynamic import to avoid build errors in production
    const { claudeCode } = require("ai-sdk-provider-claude-code");
    claudeCodeModel = (tier: "opus" | "sonnet" | "haiku") =>
      claudeCode(tier, {
        allowedTools: ["Read", "Write", "Bash", "Glob", "Grep"],
        maxBudgetUsd: 5,
        permissionMode: "acceptEdits",
      });
  }
} catch {
  // Provider not installed — skip silently
}
export { claudeCodeModel };

// Per-partner gateway with personal API key fallback
export async function getPartnerGateway(userApiKey?: string | null) {
  if (userApiKey) {
    return createGateway({ apiKey: userApiKey });
  }
  return gateway;
}
