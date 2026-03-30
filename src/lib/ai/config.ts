import { gateway } from "@ai-sdk/gateway";

// All models route through Vercel AI Gateway (AI_GATEWAY_API_KEY)
// No per-provider API keys needed.

// Extraction model — fast Haiku for cost efficiency
export const extractionModel = gateway("anthropic/claude-haiku-4-5-20251001");

// Embedding model — text-embedding-3-small = 1536 dims (matches DB schema)
export const embeddingModel = gateway.textEmbeddingModel("openai/text-embedding-3-small");

// Task-to-model mapping (see GRANGER-SPEC.md §7)
export const TASK_MODELS = {
  extraction: "anthropic/claude-sonnet-4-6-20250514",
  classification: "anthropic/claude-haiku-4-5-20251001",
  digest: "anthropic/claude-sonnet-4-6-20250514",
  compaction: "anthropic/claude-haiku-4-5-20251001",
  synthesis: "anthropic/claude-opus-4-6-20250609",
  taskSync: "anthropic/claude-haiku-4-5-20251001",
} as const;

export { gateway };
