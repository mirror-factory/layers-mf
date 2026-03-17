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

Extract the title, summaries, and entities from this document. Be specific and factual.`,
  });

  if (opts?.orgId) {
    logUsage({
      orgId: opts.orgId,
      userId: opts.userId,
      operation: "extraction",
      model: "anthropic/claude-haiku-4-5-20251001",
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      metadata: { filename },
    });
  }

  return result.object;
}
