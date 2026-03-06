import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

// Extraction model — fast Haiku for cost efficiency
export const extractionModel = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})("claude-haiku-4-5-20251001");

// Embedding model — text-embedding-3-small = 1536 dims (matches DB schema)
export const embeddingModel = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}).embedding("text-embedding-3-small");
