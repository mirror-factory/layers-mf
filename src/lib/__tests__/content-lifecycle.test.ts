import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isStale,
  getStalenessInfo,
  STALENESS_THRESHOLDS,
} from "../content-lifecycle";

/** Helper: create a date N days ago — reset to midnight for deterministic day counts */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

describe("STALENESS_THRESHOLDS", () => {
  it("has correct thresholds for each content type", () => {
    expect(STALENESS_THRESHOLDS.message).toBe(30);
    expect(STALENESS_THRESHOLDS.issue).toBe(14);
    expect(STALENESS_THRESHOLDS.document).toBe(90);
    expect(STALENESS_THRESHOLDS.meeting_transcript).toBe(Infinity);
    expect(STALENESS_THRESHOLDS.calendar_event).toBe(Infinity);
    expect(STALENESS_THRESHOLDS.file).toBe(90);
    expect(STALENESS_THRESHOLDS.default).toBe(60);
  });
});

describe("isStale", () => {
  it("returns false for fresh items", () => {
    expect(isStale("message", daysAgo(5))).toBe(false);
    expect(isStale("document", daysAgo(30))).toBe(false);
    expect(isStale("issue", daysAgo(7))).toBe(false);
  });

  it("returns true for stale items", () => {
    expect(isStale("message", daysAgo(31))).toBe(true);
    expect(isStale("issue", daysAgo(15))).toBe(true);
    expect(isStale("document", daysAgo(91))).toBe(true);
  });

  it("returns false for meeting transcripts (never stale)", () => {
    expect(isStale("meeting_transcript", daysAgo(365))).toBe(false);
    expect(isStale("meeting_transcript", daysAgo(9999))).toBe(false);
  });

  it("returns false for calendar events (never stale)", () => {
    expect(isStale("calendar_event", daysAgo(365))).toBe(false);
  });

  it("uses default threshold for unknown content types", () => {
    // default = 60 days
    expect(isStale("unknown_type", daysAgo(59))).toBe(false);
    expect(isStale("unknown_type", daysAgo(61))).toBe(true);
  });

  it("accepts string dates", () => {
    const recentDate = daysAgo(5).toISOString();
    expect(isStale("message", recentDate)).toBe(false);

    const oldDate = daysAgo(60).toISOString();
    expect(isStale("message", oldDate)).toBe(true);
  });

  it("returns true at the exact threshold boundary", () => {
    expect(isStale("message", daysAgo(30))).toBe(true);
    expect(isStale("issue", daysAgo(14))).toBe(true);
  });
});

describe("getStalenessInfo", () => {
  it("returns 'fresh' severity for items under 50% of threshold", () => {
    const info = getStalenessInfo("message", daysAgo(10)); // 10/30 = 33%
    expect(info.severity).toBe("fresh");
    expect(info.isStale).toBe(false);
    expect(info.threshold).toBe(30);
  });

  it("returns 'aging' severity for items between 50-100% of threshold", () => {
    const info = getStalenessInfo("message", daysAgo(20)); // 20/30 = 67%
    expect(info.severity).toBe("aging");
    expect(info.isStale).toBe(false);
  });

  it("returns 'stale' severity for items between 100-200% of threshold", () => {
    const info = getStalenessInfo("message", daysAgo(45)); // 45/30 = 150%
    expect(info.severity).toBe("stale");
    expect(info.isStale).toBe(true);
  });

  it("returns 'very-stale' severity for items over 200% of threshold", () => {
    const info = getStalenessInfo("message", daysAgo(65)); // 65/30 = 217%
    expect(info.severity).toBe("very-stale");
    expect(info.isStale).toBe(true);
  });

  it("returns correct daysSinceUpdate", () => {
    const info = getStalenessInfo("document", daysAgo(45));
    expect(info.daysSinceUpdate).toBe(45);
  });

  it("handles meeting transcripts as always fresh", () => {
    const info = getStalenessInfo("meeting_transcript", daysAgo(1000));
    expect(info.severity).toBe("fresh");
    expect(info.isStale).toBe(false);
    expect(info.threshold).toBe(Infinity);
    expect(info.daysSinceUpdate).toBe(1000);
  });

  it("handles calendar events as always fresh", () => {
    const info = getStalenessInfo("calendar_event", daysAgo(500));
    expect(info.severity).toBe("fresh");
    expect(info.isStale).toBe(false);
  });

  it("handles unknown content types with default threshold", () => {
    const info = getStalenessInfo("some_new_type", daysAgo(25)); // 25/60 = 42%
    expect(info.severity).toBe("fresh");
    expect(info.threshold).toBe(60);
  });

  it("handles invalid date strings as very-stale", () => {
    const info = getStalenessInfo("message", "not-a-date");
    expect(info.severity).toBe("very-stale");
    expect(info.isStale).toBe(true);
    expect(info.daysSinceUpdate).toBe(Infinity);
  });

  it("handles ISO date strings correctly", () => {
    const date = daysAgo(10).toISOString();
    const info = getStalenessInfo("issue", date); // 10/14 = 71%
    expect(info.severity).toBe("aging");
    expect(info.daysSinceUpdate).toBe(10);
  });

  it("returns correct threshold for each content type", () => {
    expect(getStalenessInfo("message", new Date()).threshold).toBe(30);
    expect(getStalenessInfo("issue", new Date()).threshold).toBe(14);
    expect(getStalenessInfo("document", new Date()).threshold).toBe(90);
    expect(getStalenessInfo("file", new Date()).threshold).toBe(90);
    expect(getStalenessInfo("meeting_transcript", new Date()).threshold).toBe(
      Infinity
    );
  });

  it("handles a date that is exactly today (0 days ago)", () => {
    const info = getStalenessInfo("message", new Date());
    expect(info.severity).toBe("fresh");
    expect(info.isStale).toBe(false);
    expect(info.daysSinceUpdate).toBe(0);
  });
});
