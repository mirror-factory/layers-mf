/**
 * AI Classification Pipeline
 *
 * Classifies content items using structured extraction via Gemini Flash.
 * Produces title, descriptions, tags, categories, and entity extraction.
 */

import { generateObject } from "ai";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import { z } from "zod";

const ClassificationSchema = z.object({
  title: z.string().describe("Concise, descriptive title for the content"),
  shortDesc: z.string().describe("~50 word description summarizing key points"),
  longDesc: z
    .string()
    .describe(
      "~200 word description covering main themes, context, and significance",
    ),
  tags: z
    .array(z.string())
    .max(10)
    .describe("Relevant tags for categorization and search"),
  categories: z
    .array(z.string())
    .max(5)
    .describe("Broad categories this content belongs to"),
  entities: z.object({
    people: z
      .array(z.string())
      .describe("People mentioned or involved"),
    topics: z
      .array(z.string())
      .describe("Key topics and themes discussed"),
    decisions: z
      .array(z.string())
      .describe("Decisions made or conclusions reached"),
    actionItems: z
      .array(z.string())
      .describe("Action items, tasks, or next steps identified"),
  }),
  language: z
    .string()
    .optional()
    .describe("Primary programming language if code content"),
  framework: z
    .string()
    .optional()
    .describe("Framework or platform if applicable"),
});

export type Classification = z.infer<typeof ClassificationSchema>;

/**
 * Classify content and extract structured metadata.
 *
 * Uses a fast model (classification tier) to keep costs low during
 * bulk processing. Content is truncated to 4000 chars to stay within
 * reasonable input limits.
 */
export async function classifyContent(
  content: string,
  contentType: string,
): Promise<Classification> {
  const { object } = await generateObject({
    model: gateway(TASK_MODELS.classification),
    schema: ClassificationSchema,
    prompt: [
      `Classify this ${contentType} content. Extract structured metadata including a concise title, short and long descriptions, relevant tags, categories, and named entities (people, topics, decisions, action items).`,
      "",
      "Be specific and factual. Only include entities that are explicitly mentioned.",
      "",
      "---",
      "",
      content.slice(0, 4000),
    ].join("\n"),
  });

  return object;
}
