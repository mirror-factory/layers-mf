import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_TZ = "America/New_York";

/**
 * Look up a user's timezone from partner_settings.
 * Falls back to DEFAULT_TZ if not set.
 *
 * Accepts any Supabase client (server, admin, browser).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserTimezone(supabase: any, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("partner_settings")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.timezone as string | undefined) || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/**
 * Browser helper — detect the user's timezone from the browser.
 */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/**
 * Format an ISO timestamp in a given timezone.
 * Returns something like "Mon Apr 28, 8:00 AM PDT".
 */
export function formatInTimezone(iso: string | Date, timezone: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Human-friendly timezone abbreviation (e.g. "PST", "JST").
 */
export function tzAbbreviation(timezone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
}
