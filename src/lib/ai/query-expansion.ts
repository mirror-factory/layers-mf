import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "./config";
import { logUsage } from "./usage";

const expansionSchema = z.object({
  alternatives: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "Alternative phrasings of the search query that might match relevant documents. Include synonyms, related terms, and different angles."
    ),
});

/**
 * Generate 2-4 alternative phrasings of a search query
 * to improve retrieval recall via multi-query expansion.
 *
 * Returns [original, ...alternatives]. For very short queries
 * (< 3 words), skips expansion and returns just [original].
 */
export async function expandQuery(
  query: string,
  opts?: { orgId?: string; userId?: string }
): Promise<string[]> {
  const trimmed = query.trim();

  // Skip expansion for very short queries
  if (trimmed.split(/\s+/).length < 3) {
    return [trimmed];
  }

  try {
    const result = await generateObject({
      model: extractionModel,
      schema: expansionSchema,
      prompt: `Given this search query, generate 2-4 alternative phrasings that might match relevant documents. Include synonyms, related terms, and different ways to ask the same question. Keep each alternative concise (under 30 words).

Query: "${trimmed}"`,
    });

    if (opts?.orgId) {
      logUsage({
        orgId: opts.orgId,
        userId: opts.userId,
        operation: "query_expansion",
        model: "google/gemini-3.1-flash-lite-preview",
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        metadata: { query: trimmed },
      });
    }

    const validAlternatives = result.object.alternatives.filter(
      (alt) => typeof alt === "string" && alt.trim().length > 0
    );

    return [trimmed, ...validAlternatives];
  } catch (error) {
    console.warn("Query expansion failed, using original query:", error);
    return [trimmed];
  }
}
