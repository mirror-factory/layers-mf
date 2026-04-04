import { embed, embedMany } from "ai";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import { logUsage } from "@/lib/ai/usage";

/**
 * Embedding configuration.
 *
 * - Primary: OpenAI text-embedding-3-small (1536 dims) — matches DB vector(1536) columns
 * - Fallback: Google text-embedding-005 (768 dims) — NOT compatible with current DB schema
 *
 * IMPORTANT: DB schema uses vector(1536) in context_items and context_chunks.
 * Changing the primary model to a different dimension requires a DB migration
 * to ALTER COLUMN + rebuild HNSW indexes + re-embed all existing items.
 *
 * Max input lengths (characters, ~4 chars/token):
 *   OpenAI text-embedding-3-small: 8191 tokens => ~32000 chars
 *   Google text-embedding-005: 2048 tokens => ~8000 chars
 */

const PRIMARY_MODEL_ID = TASK_MODELS.embedding;
const FALLBACK_MODEL_ID = TASK_MODELS.embeddingFallback;

/** Max characters to send — keeps us within token limits for both models */
const MAX_INPUT_CHARS = 8_000;

/** Batch size for embedMany calls (API limit) */
const BATCH_SIZE = 100;

type EmbeddingOpts = {
  orgId?: string;
  userId?: string;
  /** Override the default model */
  modelId?: string;
};

/**
 * Generate an embedding vector for a single text string.
 *
 * Uses Gemini text-embedding-005 by default. Falls back to OpenAI
 * text-embedding-3-small if the primary model fails.
 */
export async function generateEmbedding(
  text: string,
  opts?: EmbeddingOpts
): Promise<number[]> {
  const truncated = text.slice(0, MAX_INPUT_CHARS);
  const modelId = opts?.modelId ?? PRIMARY_MODEL_ID;

  try {
    const { embedding } = await embed({
      model: gateway.textEmbeddingModel(modelId),
      value: truncated,
    });

    trackUsage(opts, modelId, truncated.length);
    return embedding;
  } catch (primaryError) {
    // Do NOT fall back to a model with different dimensions — it would produce
    // vectors incompatible with the DB's vector(1536) columns and HNSW indexes.
    // Log the error and re-throw so callers can handle gracefully.
    console.error(
      `[embedding] Failed with ${modelId}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
    throw primaryError;
  }
}

/**
 * Generate embedding vectors for multiple texts in batches.
 *
 * Uses Gemini text-embedding-005 by default with automatic fallback
 * to OpenAI text-embedding-3-small on failure.
 */
export async function generateEmbeddings(
  texts: string[],
  opts?: EmbeddingOpts
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const modelId = opts?.modelId ?? PRIMARY_MODEL_ID;
  const allEmbeddings: number[][] = [];
  let totalChars = 0;

  try {
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const truncated = batch.map((t) => t.slice(0, MAX_INPUT_CHARS));
      totalChars += truncated.reduce((sum, t) => sum + t.length, 0);

      const { embeddings } = await embedMany({
        model: gateway.textEmbeddingModel(modelId),
        values: truncated,
      });
      allEmbeddings.push(...embeddings);
    }

    trackUsage(opts, modelId, totalChars, texts.length);
    return allEmbeddings;
  } catch (primaryError) {
    // Do NOT fall back to a model with different dimensions — see generateEmbedding comment.
    console.error(
      `[embedding] Batch failed with ${modelId}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
    throw primaryError;
  }
}

/** Fire-and-forget usage tracking */
function trackUsage(
  opts: EmbeddingOpts | undefined,
  modelId: string,
  totalChars: number,
  batchSize?: number
): void {
  if (!opts?.orgId) return;

  logUsage({
    orgId: opts.orgId,
    userId: opts.userId,
    operation: "embedding",
    model: modelId,
    inputTokens: Math.ceil(totalChars / 4),
    metadata: batchSize
      ? { batchSize, totalChars }
      : { textLength: totalChars },
  });
}
