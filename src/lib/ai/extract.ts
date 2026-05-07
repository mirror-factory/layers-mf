import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "./config";
import { logUsage } from "./usage";

const ExtractionSchema = z.object({
  title: z.string().describe("Concise document title (max 80 chars)"),
  description_short: z.string().describe("1-2 sentence summary"),
  description_long: z.string().describe("Detailed 3-5 paragraph summary covering key topics, decisions, and outcomes"),
  entities: z.object({
    people: z.array(z.string()).describe("Names of people mentioned"),
    topics: z.array(z.string()).describe("Key topics and themes"),
    action_items: z.array(z.string()).describe("Action items or tasks mentioned"),
    decisions: z.array(z.string()).describe("Decisions made"),
  }),
  emotional_signals: z.array(z.string()).describe('Emotional tone or sentiment signals detected (e.g., "frustration with timeline", "excitement about launch", "concern about budget")'),
  tacit_observations: z.array(z.string()).describe('Implicit insights not explicitly stated but inferred from context (e.g., "team may be understaffed based on repeated deadline misses", "client relationship appears strained")'),
  confidence_score: z.number().min(0).max(1).describe('Confidence in the extraction quality, 0.0 to 1.0. Lower for short/ambiguous content, higher for clear structured documents'),
  source_quote: z.string().optional().describe('The single most important verbatim quote from the document that captures its essence'),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export async function extractStructured(
  rawContent: string,
  filename: string,
  opts?: { orgId?: string; userId?: string }
): Promise<Extraction> {
  const truncated = rawContent.slice(0, 12000); // ~3k tokens context budget

  const result = await generateObject({
    model: extractionModel,
    schema: ExtractionSchema,
    prompt: `You are extracting structured information from a document.

Filename: ${filename}

Document content:
${truncated}

Extract the title, summaries, and entities from this document. Be specific and factual.

Also extract:
- Emotional signals: tone, sentiment, feelings expressed or implied
- Tacit observations: implicit insights not explicitly stated but inferable from patterns
- Confidence score: 0.0-1.0 based on content clarity and extraction certainty
- Source quote: the single most important verbatim quote that captures the document's essence`,
  });

  if (opts?.orgId) {
    logUsage({
      orgId: opts.orgId,
      userId: opts.userId,
      operation: "extraction",
      model: "google/gemini-3.1-flash-lite-preview",
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      metadata: { filename },
    });
  }

  return result.object;
}
