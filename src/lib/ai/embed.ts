import { embed, embedMany } from "ai";
import { embeddingModel } from "./config";

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text.slice(0, 8000),
  });
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Process in batches of 100 to stay within API limits
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch.map((t) => t.slice(0, 8000)),
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
