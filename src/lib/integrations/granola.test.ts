import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseGranolaPayload,
  verifyGranolaToken,
  buildGranolaMetadata,
} from "./granola";

describe("parseGranolaPayload", () => {
  it("accepts a valid payload", () => {
    const result = parseGranolaPayload({
      source: "granola",
      content: "Speaker A: Hello\nSpeaker B: Hi",
      metadata: {
        title: "Weekly Standup",
        attendees: ["Alice", "Bob"],
        date: "2026-03-09",
        duration: 30,
      },
    });
    expect(result.source).toBe("granola");
    expect(result.metadata.title).toBe("Weekly Standup");
    expect(result.metadata.attendees).toEqual(["Alice", "Bob"]);
    expect(result.metadata.duration).toBe(30);
  });

  it("defaults attendees to empty array", () => {
    const result = parseGranolaPayload({
      source: "granola",
      content: "transcript text",
      metadata: { title: "Meeting", date: "2026-01-01" },
    });
    expect(result.metadata.attendees).toEqual([]);
  });

  it("allows optional duration", () => {
    const result = parseGranolaPayload({
      source: "granola",
      content: "transcript text",
      metadata: { title: "Meeting", date: "2026-01-01", attendees: [] },
    });
    expect(result.metadata.duration).toBeUndefined();
  });

  it("rejects missing source", () => {
    expect(() =>
      parseGranolaPayload({
        content: "text",
        metadata: { title: "T", date: "2026-01-01" },
      })
    ).toThrow();
  });

  it("rejects wrong source value", () => {
    expect(() =>
      parseGranolaPayload({
        source: "slack",
        content: "text",
        metadata: { title: "T", date: "2026-01-01" },
      })
    ).toThrow();
  });

  it("rejects empty content", () => {
    expect(() =>
      parseGranolaPayload({
        source: "granola",
        content: "",
        metadata: { title: "T", date: "2026-01-01" },
      })
    ).toThrow();
  });

  it("rejects missing title", () => {
    expect(() =>
      parseGranolaPayload({
        source: "granola",
        content: "text",
        metadata: { date: "2026-01-01" },
      })
    ).toThrow();
  });

  it("rejects missing date", () => {
    expect(() =>
      parseGranolaPayload({
        source: "granola",
        content: "text",
        metadata: { title: "T" },
      })
    ).toThrow();
  });
});

describe("verifyGranolaToken", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when env var is not set", () => {
    vi.stubEnv("GRANOLA_WEBHOOK_TOKEN", "");
    expect(verifyGranolaToken("Bearer some-token")).toBe(false);
  });

  it("returns false when header is null", () => {
    vi.stubEnv("GRANOLA_WEBHOOK_TOKEN", "my-secret");
    expect(verifyGranolaToken(null)).toBe(false);
  });

  it("returns true with matching Bearer token", () => {
    vi.stubEnv("GRANOLA_WEBHOOK_TOKEN", "my-secret");
    expect(verifyGranolaToken("Bearer my-secret")).toBe(true);
  });

  it("returns true with raw token (no Bearer prefix)", () => {
    vi.stubEnv("GRANOLA_WEBHOOK_TOKEN", "my-secret");
    expect(verifyGranolaToken("my-secret")).toBe(true);
  });

  it("returns false with wrong token", () => {
    vi.stubEnv("GRANOLA_WEBHOOK_TOKEN", "my-secret");
    expect(verifyGranolaToken("Bearer wrong")).toBe(false);
  });
});

describe("buildGranolaMetadata", () => {
  it("builds metadata with all fields", () => {
    const result = buildGranolaMetadata({
      title: "Meeting",
      attendees: ["Alice"],
      date: "2026-03-09",
      duration: 45,
    });
    expect(result).toEqual({
      attendees: ["Alice"],
      meeting_date: "2026-03-09",
      duration_minutes: 45,
    });
  });

  it("sets duration_minutes to null when undefined", () => {
    const result = buildGranolaMetadata({
      title: "Meeting",
      attendees: [],
      date: "2026-03-09",
    });
    expect(result.duration_minutes).toBeNull();
  });
});
