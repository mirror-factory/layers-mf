import { embed, embedMany } from "ai";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import { logUsage } from "@/lib/ai/usage";

/**
 * Embedding configuration.
 *
 * - Primary: Google text-embedding-004 (768 dims, cheaper, good quality)
 * - Fallback: OpenAI text-embedding-3-small (1536 dims)
 *
 * Max input lengths (characters, ~4 chars/token):
 *   Google text-embedding-004: 2048 tokens => ~8000 chars
 *   OpenAI text-embedding-3-small: 8191 tokens => ~32000 chars
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
 * Uses Gemini text-embedding-004 by default. Falls back to OpenAI
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
    // If caller specified a model explicitly, don't fallback
    if (opts?.modelId) throw primaryError;

    console.warn(
      `Embedding failed with ${modelId}, falling back to ${FALLBACK_MODEL_ID}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );

    const { embedding } = await embed({
      model: gateway.textEmbeddingModel(FALLBACK_MODEL_ID),
      value: truncated,
    });

    trackUsage(opts, FALLBACK_MODEL_ID, truncated.length);
    return embedding;
  }
}

/**
 * Generate embedding vectors for multiple texts in batches.
 *
 * Uses Gemini text-embedding-004 by default with automatic fallback
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
    if (opts?.modelId) throw primaryError;

    console.warn(
      `Batch embedding failed with ${modelId}, falling back to ${FALLBACK_MODEL_ID}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );

    // Reset and retry with fallback
    allEmbeddings.length = 0;
    totalChars = 0;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const truncated = batch.map((t) => t.slice(0, MAX_INPUT_CHARS));
      totalChars += truncated.reduce((sum, t) => sum + t.length, 0);

      const { embeddings } = await embedMany({
        model: gateway.textEmbeddingModel(FALLBACK_MODEL_ID),
        values: truncated,
      });
      allEmbeddings.push(...embeddings);
    }

    trackUsage(opts, FALLBACK_MODEL_ID, totalChars, texts.length);
    return allEmbeddings;
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
