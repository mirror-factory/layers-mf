import { gateway } from "@ai-sdk/gateway";

// All models route through Vercel AI Gateway (AI_GATEWAY_API_KEY)
// No per-provider API keys needed.

// Extraction model — fast Haiku for cost efficiency
export const extractionModel = gateway("anthropic/claude-haiku-4-5-20251001");

// Embedding model — text-embedding-3-small = 1536 dims (matches DB schema)
export const embeddingModel = gateway.textEmbeddingModel("openai/text-embedding-3-small");
