import { describe, it, expect } from "vitest";
import { computeRecall } from "./extraction.eval";

describe("computeRecall", () => {
  it("returns recall=1 when all expected items are found", () => {
    const expected = [
      "David set up pgvector by Wednesday",
      "Priya build onboarding prototype by Friday",
    ];
    const extracted = [
      "David will set up the pgvector extension by Wednesday EOD",
      "Priya needs to build the onboarding flow prototype by Friday",
      "Marcus to remove CSV export code",
    ];
    const { recall, matched, missed } = computeRecall(expected, extracted);
    expect(recall).toBe(1);
    expect(matched).toHaveLength(2);
    expect(missed).toHaveLength(0);
  });

  it("returns recall=0 when no expected items match", () => {
    const expected = [
      "Deploy the new authentication service",
      "Review the billing integration",
    ];
    const extracted = [
      "Set up the database migration",
      "Update the CI pipeline configuration",
    ];
    const { recall, missed } = computeRecall(expected, extracted);
    expect(recall).toBe(0);
    expect(missed).toHaveLength(2);
  });

  it("returns partial recall when some items match", () => {
    const expected = [
      "Alex set up PgBouncer by Friday",
      "Nina create migration plan by Wednesday",
      "Deploy quantum computing cluster",
    ];
    const extracted = [
      "Alex to configure PgBouncer on production by Friday",
      "Nina will draft the database migration plan by next Wednesday",
    ];
    const { recall, matched, missed } = computeRecall(expected, extracted);
    expect(recall).toBeCloseTo(2 / 3, 1);
    expect(matched).toHaveLength(2);
    expect(missed).toHaveLength(1);
    expect(missed[0]).toContain("quantum");
  });

  it("returns recall=1 for empty expected list", () => {
    const { recall } = computeRecall([], ["some extracted item"]);
    expect(recall).toBe(1);
  });

  it("returns recall=0 for non-empty expected with empty extracted", () => {
    const { recall, missed } = computeRecall(["something expected"], []);
    expect(recall).toBe(0);
    expect(missed).toHaveLength(1);
  });

  it("handles semantic overlap with different wording", () => {
    const expected = ["Tom raise SOC 2 at leadership meeting"];
    const extracted = ["Tom to discuss SOC 2 certification at the leadership meeting next Tuesday"];
    const { recall } = computeRecall(expected, extracted);
    expect(recall).toBe(1);
  });

  it("respects custom threshold parameter", () => {
    const expected = ["review code"];
    const extracted = ["conduct a thorough code review session"];
    // With high threshold, won't match
    const strict = computeRecall(expected, extracted, 0.8);
    expect(strict.recall).toBe(0);
    // With low threshold, will match
    const loose = computeRecall(expected, extracted, 0.15);
    expect(loose.recall).toBe(1);
  });

  it("validates fixture coverage — all 10 transcripts have expected extractions", async () => {
    const { TRANSCRIPTS } = await import("./fixtures/transcripts");
    const { EXPECTED_EXTRACTIONS } = await import("./fixtures/expected-extractions");

    expect(TRANSCRIPTS).toHaveLength(10);
    expect(EXPECTED_EXTRACTIONS).toHaveLength(10);

    for (const transcript of TRANSCRIPTS) {
      const expected = EXPECTED_EXTRACTIONS.find((e) => e.id === transcript.id);
      expect(expected, `Missing expected extraction for ${transcript.id}`).toBeDefined();
      expect(expected!.action_items.length).toBeGreaterThan(0);
      expect(expected!.decisions.length).toBeGreaterThan(0);
      expect(expected!.people.length).toBeGreaterThan(0);
    }
  });
});
