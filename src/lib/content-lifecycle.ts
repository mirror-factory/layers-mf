/** Staleness thresholds in days, per content_type */
export const STALENESS_THRESHOLDS: Record<string, number> = {
  message: 30,
  issue: 14,
  document: 90,
  meeting_transcript: Infinity, // never stale
  calendar_event: Infinity, // never stale (historical record)
  file: 90,
  default: 60,
};

export type StalenessSeverity = "fresh" | "aging" | "stale" | "very-stale";

/** Get the threshold for a content type, falling back to default */
function getThreshold(contentType: string): number {
  return STALENESS_THRESHOLDS[contentType] ?? STALENESS_THRESHOLDS.default;
}

/** Parse a date input, returning null if invalid */
function parseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const parsed = date instanceof Date ? date : new Date(date);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Calculate days between two dates */
function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

/** Check if an item is stale based on its content_type and last update */
export function isStale(
  contentType: string,
  lastUpdated: Date | string
): boolean {
  const threshold = getThreshold(contentType);
  if (threshold === Infinity) return false;

  const date = parseDate(lastUpdated);
  if (!date) return true; // no valid date = treat as stale

  const days = daysBetween(date, new Date());
  return days >= threshold;
}

/** Get staleness info for an item */
export function getStalenessInfo(
  contentType: string,
  lastUpdated: Date | string
): {
  isStale: boolean;
  daysSinceUpdate: number;
  threshold: number;
  severity: StalenessSeverity;
} {
  const threshold = getThreshold(contentType);
  const date = parseDate(lastUpdated);

  // Items that never go stale
  if (threshold === Infinity) {
    const days = date ? daysBetween(date, new Date()) : 0;
    return {
      isStale: false,
      daysSinceUpdate: Math.floor(days),
      threshold,
      severity: "fresh",
    };
  }

  // No valid date = very stale
  if (!date) {
    return {
      isStale: true,
      daysSinceUpdate: Infinity,
      threshold,
      severity: "very-stale",
    };
  }

  const days = daysBetween(date, new Date());
  const ratio = days / threshold;

  let severity: StalenessSeverity;
  if (ratio < 0.5) {
    severity = "fresh";
  } else if (ratio < 1) {
    severity = "aging";
  } else if (ratio < 2) {
    severity = "stale";
  } else {
    severity = "very-stale";
  }

  return {
    isStale: days >= threshold,
    daysSinceUpdate: Math.floor(days),
    threshold,
    severity,
  };
}
