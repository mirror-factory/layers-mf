import { embed, embedMany } from "ai";
import { embeddingModel } from "./config";
import { logUsage } from "./usage";

export async function generateEmbedding(
  text: string,
  opts?: { orgId?: string; userId?: string }
): Promise<number[]> {
  const truncated = text.slice(0, 8000);
  const { embedding } = await embed({
    model: embeddingModel,
    value: truncated,
  });

  if (opts?.orgId) {
    logUsage({
      orgId: opts.orgId,
      userId: opts.userId,
      operation: "embedding",
      model: "openai/text-embedding-3-small",
      inputTokens: Math.ceil(truncated.length / 4),
      metadata: { textLength: truncated.length },
    });
  }

  return embedding;
}

export async function generateEmbeddings(
  texts: string[],
  opts?: { orgId?: string; userId?: string }
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Process in batches of 100 to stay within API limits
  const batchSize = 100;
  const allEmbeddings: number[][] = [];
  let totalChars = 0;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const truncated = batch.map((t) => t.slice(0, 8000));
    totalChars += truncated.reduce((sum, t) => sum + t.length, 0);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: truncated,
    });
    allEmbeddings.push(...embeddings);
  }

  if (opts?.orgId) {
    logUsage({
      orgId: opts.orgId,
      userId: opts.userId,
      operation: "embedding",
      model: "openai/text-embedding-3-small",
      inputTokens: Math.ceil(totalChars / 4),
      metadata: { batchSize: texts.length, totalChars },
    });
  }

  return allEmbeddings;
}
