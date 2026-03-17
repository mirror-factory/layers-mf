import { describe, it, expect } from "vitest";
import {
  windowedSourceId,
  isCurrentWindow,
  getISOWeekNumber,
  currentWeekLabel,
} from "../message-windows";

describe("getISOWeekNumber", () => {
  it("returns correct week for a mid-year date", () => {
    // 2026-03-17 is a Tuesday in ISO week 12
    const result = getISOWeekNumber(new Date("2026-03-17"));
    expect(result).toEqual({ year: 2026, week: 12 });
  });

  it("returns week 1 for early January", () => {
    // 2026-01-05 is a Monday — ISO week 2
    const result = getISOWeekNumber(new Date("2026-01-05"));
    expect(result).toEqual({ year: 2026, week: 2 });
  });

  it("handles year boundary — Dec 31 that falls in week 1 of next year", () => {
    // 2025-12-31 is a Wednesday — ISO week 1 of 2026
    const result = getISOWeekNumber(new Date("2025-12-31"));
    expect(result).toEqual({ year: 2026, week: 1 });
  });

  it("handles year boundary — Dec 31 that stays in last week of current year", () => {
    // 2026-12-31 is a Thursday — ISO week 53 of 2026
    const result = getISOWeekNumber(new Date("2026-12-31"));
    expect(result).toEqual({ year: 2026, week: 53 });
  });

  it("returns week 1 for Jan 1 that is a Thursday", () => {
    // 2026-01-01 is a Thursday — ISO week 1 of 2026
    const result = getISOWeekNumber(new Date("2026-01-01"));
    expect(result).toEqual({ year: 2026, week: 1 });
  });
});

describe("windowedSourceId", () => {
  it("generates correct format with explicit date", () => {
    const date = new Date("2026-03-17"); // Week 12
    const result = windowedSourceId("slack", "C123ABC", date);
    expect(result).toBe("slack-C123ABC-2026-W12");
  });

  it("uses current date when no date provided", () => {
    const result = windowedSourceId("slack", "C123");
    // Should match the format: slack-C123-{year}-W{week}
    expect(result).toMatch(/^slack-C123-\d{4}-W\d{2}$/);
  });

  it("zero-pads single-digit week numbers", () => {
    // 2026-01-01 is ISO week 1
    const date = new Date("2026-01-01");
    const result = windowedSourceId("slack", "C999", date);
    expect(result).toBe("slack-C999-2026-W01");
  });

  it("works with discord-channel provider prefix", () => {
    const date = new Date("2026-03-17");
    const result = windowedSourceId("discord-channel", "12345", date);
    expect(result).toBe("discord-channel-12345-2026-W12");
  });

  it("handles channel IDs with hyphens", () => {
    const date = new Date("2026-03-17");
    const result = windowedSourceId("slack", "C-123-ABC", date);
    expect(result).toBe("slack-C-123-ABC-2026-W12");
  });

  it("handles double-digit week numbers without extra padding", () => {
    // 2026-06-15 should be around week 25
    const date = new Date("2026-06-15");
    const result = windowedSourceId("slack", "C1", date);
    expect(result).toMatch(/^slack-C1-2026-W\d{2}$/);
    // Week number should be 25
    const { week } = getISOWeekNumber(date);
    expect(result).toBe(`slack-C1-2026-W${String(week).padStart(2, "0")}`);
  });
});

describe("currentWeekLabel", () => {
  it("returns formatted week label", () => {
    const label = currentWeekLabel(new Date("2026-03-17"));
    expect(label).toBe("W12");
  });

  it("zero-pads single-digit weeks", () => {
    const label = currentWeekLabel(new Date("2026-01-01"));
    expect(label).toBe("W01");
  });

  it("uses current date when no date provided", () => {
    const label = currentWeekLabel();
    expect(label).toMatch(/^W\d{2}$/);
  });
});

describe("isCurrentWindow", () => {
  it("returns true for a source_id matching the current week", () => {
    const now = new Date();
    const sourceId = windowedSourceId("slack", "C123", now);
    expect(isCurrentWindow(sourceId)).toBe(true);
  });

  it("returns false for a past week", () => {
    // Create a source_id from 8 weeks ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 56);
    const sourceId = windowedSourceId("slack", "C123", pastDate);
    expect(isCurrentWindow(sourceId)).toBe(false);
  });

  it("returns false for a source_id with too few segments", () => {
    expect(isCurrentWindow("slack-C123")).toBe(false);
  });

  it("handles compound provider names like discord-channel", () => {
    const now = new Date();
    const sourceId = windowedSourceId("discord-channel", "12345", now);
    // The source_id is "discord-channel-12345-2026-W12"
    // Provider is "discord", channelId parsed would be "channel-12345"
    // But windowedSourceId("discord", "channel-12345") should produce the same result
    // Actually, isCurrentWindow splits on first "-" for provider, which is "discord"
    // and channelId is "channel-12345"
    // So windowedSourceId("discord", "channel-12345") should equal the sourceId
    expect(isCurrentWindow(sourceId)).toBe(true);
  });

  it("handles channel IDs that contain hyphens", () => {
    const now = new Date();
    const sourceId = windowedSourceId("slack", "C-123-ABC", now);
    expect(isCurrentWindow(sourceId)).toBe(true);
  });
});
