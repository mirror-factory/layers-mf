import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Check if a webhook event has already been processed.
 * If not, mark it as processing (claim it).
 * Returns true if this is a new event that should be processed.
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING for atomic deduplication.
 */
export async function claimWebhookEvent(
  provider: string,
  eventId: string,
  eventType?: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_id: eventId,
      event_type: eventType ?? null,
      status: "processing",
    })
    .select("id")
    .maybeSingle();

  // Unique constraint violation means this event was already claimed
  if (error?.code === "23505") {
    return false;
  }

  // Any other error — log but treat as unclaimed to avoid dropping events
  if (error) {
    console.error(
      `[webhook-dedup] Error claiming event ${provider}/${eventId}:`,
      error.message
    );
    return true;
  }

  return data !== null;
}

/**
 * Mark a claimed event as completed or failed.
 */
export async function completeWebhookEvent(
  provider: string,
  eventId: string,
  status: "completed" | "failed"
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("webhook_events")
    .update({
      status,
      processed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("provider", provider)
    .eq("event_id", eventId);

  if (error) {
    console.error(
      `[webhook-dedup] Error completing event ${provider}/${eventId}:`,
      error.message
    );
  }
}

/**
 * Delete webhook events older than 7 days.
 * Call periodically (e.g., via cron or scheduled function).
 * Returns the number of deleted rows.
 */
export async function cleanupOldEvents(): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("webhook_events")
    .delete()
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    console.error("[webhook-dedup] Error cleaning up old events:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Generate a deterministic event ID from a webhook payload.
 * Use when the provider doesn't supply a unique event/delivery ID.
 */
export function hashPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}
