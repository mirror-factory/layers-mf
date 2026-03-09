import { z } from "zod";

/**
 * Full extraction schema for the context processing pipeline.
 * Extends the base extraction with sentiment and project detection.
 */
export const ExtractionSchema = z.object({
  title: z.string().describe("Concise document title (max 80 chars)"),
  description_short: z.string().describe("1-2 sentence summary"),
  description_long: z
    .string()
    .describe(
      "Detailed 3-5 paragraph summary covering key topics, decisions, and outcomes"
    ),
  entities: z.object({
    people: z.array(z.string()).describe("Names of people mentioned"),
    decisions: z
      .array(z.string())
      .describe("Decisions made or conclusions reached"),
    action_items: z
      .array(z.string())
      .describe("Action items, tasks, or follow-ups mentioned"),
    topics: z.array(z.string()).describe("Key topics and themes"),
    projects: z
      .array(z.string())
      .describe("Project names or initiatives referenced"),
    dates: z
      .array(z.string())
      .describe("Important dates, deadlines, or timeframes mentioned"),
  }),
  sentiment: z
    .enum(["positive", "neutral", "negative", "mixed"])
    .describe("Overall sentiment of the content"),
  summary: z
    .string()
    .describe("A single paragraph executive summary of the content"),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;

/**
 * Schema for session-linking: AI picks which active sessions match the content.
 */
export const SessionMatchSchema = z.object({
  matches: z.array(
    z.object({
      sessionId: z.string().describe("UUID of the matching session"),
      relevanceScore: z
        .number()
        .min(0)
        .max(1)
        .describe("How relevant this content is to the session (0-1)"),
      reason: z
        .string()
        .describe("Brief explanation of why this content is relevant"),
    })
  ),
});

export type SessionMatchResult = z.infer<typeof SessionMatchSchema>;
