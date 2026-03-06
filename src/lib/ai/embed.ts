import { embed } from "ai";
import { embeddingModel } from "./config";

export async function generateEmbedding(text: string): Promise<number[]> {
  // Embed title + short description for best retrieval signal
  const { embedding } = await embed({
    model: embeddingModel,
    value: text.slice(0, 8000),
  });
  return embedding;
}
