/**
 * Weekly rolling windows for message streams (Slack, Discord).
 *
 * Instead of one context_item per channel that gets overwritten on each sync,
 * messages are bucketed into weekly windows. Each week gets its own
 * context_item with a deterministic source_id. Old weeks are immutable
 * and fully searchable.
 */

/**
 * Get the ISO week number for a given date.
 * ISO 8601: week 1 is the week containing the first Thursday of the year.
 */
export function getISOWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

/**
 * Generate a time-bucketed source_id for message streams.
 * Format: "{provider}-{channelId}-{year}-W{weekNumber}"
 * e.g., "slack-C123-2026-W12"
 */
export function windowedSourceId(
  provider: string,
  channelId: string,
  date?: Date
): string {
  const d = date ?? new Date();
  const { year, week } = getISOWeekNumber(d);
  return `${provider}-${channelId}-${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Get the current week number string (e.g., "W12") for display in titles.
 */
export function currentWeekLabel(date?: Date): string {
  const d = date ?? new Date();
  const { week } = getISOWeekNumber(d);
  return `W${String(week).padStart(2, "0")}`;
}

/**
 * Check if a windowed source_id is for the current week.
 */
export function isCurrentWindow(sourceId: string): boolean {
  // Extract provider and channelId from the source_id
  // Format: "{provider}-{channelId}-{year}-W{week}"
  // The year-W{week} suffix is always the last two segments
  const parts = sourceId.split("-");
  if (parts.length < 4) return false;

  // Last part is W{nn}, second-to-last is year
  const provider = parts[0];
  // channelId is everything between provider and the year-W{week} suffix
  const channelId = parts.slice(1, -2).join("-");

  const current = windowedSourceId(provider, channelId, new Date());
  return sourceId === current;
}
