import { z } from "zod";

/**
 * Granola meeting transcript webhook payload schema.
 * Used for both the granola-webhook daemon and manual transcript uploads.
 */
export const GranolaPayloadSchema = z.object({
  source: z.literal("granola"),
  content: z.string().min(1, "Transcript content is required"),
  metadata: z.object({
    title: z.string().min(1, "Meeting title is required"),
    attendees: z.array(z.string()).default([]),
    date: z.string().min(1, "Meeting date is required"),
    duration: z.number().positive().optional(),
  }),
});

export type GranolaPayload = z.infer<typeof GranolaPayloadSchema>;

/**
 * Parse and validate a Granola webhook payload.
 * Returns the validated payload or throws a descriptive error.
 */
export function parseGranolaPayload(body: unknown): GranolaPayload {
  return GranolaPayloadSchema.parse(body);
}

/**
 * Verify the Granola webhook token from the Authorization header.
 * Returns true if valid, false if invalid or missing.
 */
export function verifyGranolaToken(authHeader: string | null): boolean {
  const expected = process.env.GRANOLA_WEBHOOK_TOKEN;
  if (!expected) return false;
  if (!authHeader) return false;

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return token === expected;
}

/**
 * Build source_metadata for a Granola context item.
 */
export function buildGranolaMetadata(metadata: GranolaPayload["metadata"]) {
  return {
    attendees: metadata.attendees,
    meeting_date: metadata.date,
    duration_minutes: metadata.duration ?? null,
  };
}
