/**
 * Extraction pipeline eval (PROD-133).
 *
 * Runs extractStructured() against 10 fixture transcripts, compares output
 * to manually annotated expected extractions, and scores:
 *   - Action item recall: % of expected action items found
 *   - Decision recall:   % of expected decisions found
 *
 * Requires: AI_GATEWAY_API_KEY (calls the extraction model via gateway).
 * Run: pnpm eval:extraction
 */
import { describe, it, expect } from "vitest";
import { extractStructured, Extraction } from "@/lib/ai/extract";
import { TRANSCRIPTS } from "./fixtures/transcripts";
import { EXPECTED_EXTRACTIONS, ExpectedExtraction } from "./fixtures/expected-extractions";

// --- Baseline thresholds (update when scores improve) ---
const BASELINE_ACTION_ITEM_RECALL = 0.6; // 60%
const BASELINE_DECISION_RECALL = 0.6; // 60%
const REGRESSION_TOLERANCE = 0.1; // fail if score drops >10% from baseline
const MIN_ACTION_ITEM_RECALL = BASELINE_ACTION_ITEM_RECALL - REGRESSION_TOLERANCE;
const MIN_DECISION_RECALL = BASELINE_DECISION_RECALL - REGRESSION_TOLERANCE;

// --- Scoring utilities ---

/**
 * Tokenize a string into lowercase words (alphanumeric only).
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Jaccard similarity between two token sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * For each expected item, find the best matching extracted item.
 * Returns the recall score (fraction of expected items matched).
 */
export function computeRecall(
  expected: string[],
  extracted: string[],
  threshold = 0.25
): { recall: number; matched: string[]; missed: string[] } {
  if (expected.length === 0) return { recall: 1, matched: [], missed: [] };

  const extractedTokens = extracted.map(tokenize);
  const matched: string[] = [];
  const missed: string[] = [];

  for (const exp of expected) {
    const expTokens = tokenize(exp);
    const bestScore = Math.max(
      0,
      ...extractedTokens.map((et) => jaccardSimilarity(expTokens, et))
    );
    if (bestScore >= threshold) {
      matched.push(exp);
    } else {
      missed.push(exp);
    }
  }

  return {
    recall: matched.length / expected.length,
    matched,
    missed,
  };
}

// --- Eval runner ---

const hasGatewayKey = !!process.env.AI_GATEWAY_API_KEY;

describe.skipIf(!hasGatewayKey)("Extraction Eval (PROD-133)", () => {
  const results: {
    id: string;
    actionItemRecall: number;
    decisionRecall: number;
    missedActions: string[];
    missedDecisions: string[];
  }[] = [];

  // Run each fixture as an individual test
  for (const transcript of TRANSCRIPTS) {
    const expected = EXPECTED_EXTRACTIONS.find((e) => e.id === transcript.id);
    if (!expected) continue;

    it(`extracts entities from: ${transcript.filename}`, { timeout: 30_000 }, async () => {
      const extraction = await extractStructured(
        transcript.transcript,
        transcript.filename
      );

      // Verify basic structure
      expect(extraction).toHaveProperty("title");
      expect(extraction).toHaveProperty("entities");
      expect(extraction.entities).toHaveProperty("action_items");
      expect(extraction.entities).toHaveProperty("decisions");
      expect(extraction.entities.action_items.length).toBeGreaterThan(0);

      // Score action items
      const actionResult = computeRecall(
        expected.action_items,
        extraction.entities.action_items
      );

      // Score decisions
      const decisionResult = computeRecall(
        expected.decisions,
        extraction.entities.decisions
      );

      results.push({
        id: transcript.id,
        actionItemRecall: actionResult.recall,
        decisionRecall: decisionResult.recall,
        missedActions: actionResult.missed,
        missedDecisions: decisionResult.missed,
      });

      // Individual test: at least 40% recall per fixture
      expect(actionResult.recall).toBeGreaterThanOrEqual(0.4);
    });
  }

  // ---------------------------------------------------------------------------
  // Entity extraction coverage: people, dates, topics
  // ---------------------------------------------------------------------------
  it("extraction covers people entities", { timeout: 30_000 }, async () => {
    // Pick the first transcript that has expected people
    const transcript = TRANSCRIPTS[0];
    const expected = EXPECTED_EXTRACTIONS.find((e) => e.id === transcript.id);
    if (!expected) return;

    const extraction = await extractStructured(
      transcript.transcript,
      transcript.filename
    );

    // Check that people are mentioned somewhere in the extraction output
    const extractionText = JSON.stringify(extraction).toLowerCase();
    let foundCount = 0;
    for (const person of expected.people) {
      const lastName = person.split(" ").pop()!.toLowerCase();
      if (extractionText.includes(lastName)) {
        foundCount++;
      }
    }

    const personRecall = foundCount / expected.people.length;
    console.log(
      `\nPerson recall for ${transcript.id}: ${(personRecall * 100).toFixed(0)}% (${foundCount}/${expected.people.length})`
    );
    // At least 50% of expected people should appear somewhere
    expect(personRecall).toBeGreaterThanOrEqual(0.5);
  });

  it("extraction covers topic entities", { timeout: 30_000 }, async () => {
    const transcript = TRANSCRIPTS[0];
    const expected = EXPECTED_EXTRACTIONS.find((e) => e.id === transcript.id);
    if (!expected) return;

    const extraction = await extractStructured(
      transcript.transcript,
      transcript.filename
    );

    const extractionText = JSON.stringify(extraction).toLowerCase();
    let foundCount = 0;
    for (const topic of expected.topics) {
      // Check if the core keyword of the topic appears
      const keywords = topic.toLowerCase().split(/\s+/);
      const found = keywords.some((kw) => kw.length > 3 && extractionText.includes(kw));
      if (found) foundCount++;
    }

    const topicRecall = foundCount / expected.topics.length;
    console.log(
      `\nTopic recall for ${transcript.id}: ${(topicRecall * 100).toFixed(0)}% (${foundCount}/${expected.topics.length})`
    );
    expect(topicRecall).toBeGreaterThanOrEqual(0.4);
  });

  // ---------------------------------------------------------------------------
  // Fixture diversity check
  // ---------------------------------------------------------------------------
  it("fixtures cover diverse content types", () => {
    const ids = TRANSCRIPTS.map((t) => t.id);
    const uniquePrefixes = new Set(ids.map((id) => id.split("-")[0]));

    console.log(`\nFixture diversity:`);
    console.log(`  Total transcripts: ${TRANSCRIPTS.length}`);
    console.log(`  Unique prefixes: ${[...uniquePrefixes].join(", ")}`);
    console.log(`  Expected extractions: ${EXPECTED_EXTRACTIONS.length}`);

    // Should have at least 3 different content categories
    expect(uniquePrefixes.size).toBeGreaterThanOrEqual(3);
    // All transcripts should have expected extractions
    expect(EXPECTED_EXTRACTIONS.length).toBe(TRANSCRIPTS.length);
  });

  it("expected extractions cover all entity types", () => {
    let totalPeople = 0;
    let totalTopics = 0;
    let totalActions = 0;
    let totalDecisions = 0;

    for (const exp of EXPECTED_EXTRACTIONS) {
      totalPeople += exp.people.length;
      totalTopics += exp.topics.length;
      totalActions += exp.action_items.length;
      totalDecisions += exp.decisions.length;
    }

    console.log(`\nEntity coverage across all fixtures:`);
    console.log(`  People: ${totalPeople}`);
    console.log(`  Topics: ${totalTopics}`);
    console.log(`  Action items: ${totalActions}`);
    console.log(`  Decisions: ${totalDecisions}`);

    expect(totalPeople).toBeGreaterThan(0);
    expect(totalTopics).toBeGreaterThan(0);
    expect(totalActions).toBeGreaterThan(0);
    expect(totalDecisions).toBeGreaterThan(0);
  });

  // Aggregate scoring
  it("aggregate: action item recall above baseline", () => {
    expect(results.length).toBeGreaterThan(0);

    const avgRecall =
      results.reduce((sum, r) => sum + r.actionItemRecall, 0) / results.length;

    console.log(`\n[RESULTS] Action Item Recall: ${(avgRecall * 100).toFixed(1)}% (baseline: ${BASELINE_ACTION_ITEM_RECALL * 100}%, min: ${MIN_ACTION_ITEM_RECALL * 100}%)`);

    for (const r of results) {
      console.log(
        `  ${r.id}: ${(r.actionItemRecall * 100).toFixed(0)}%` +
          (r.missedActions.length > 0
            ? ` — missed: ${r.missedActions.join("; ")}`
            : "")
      );
    }

    expect(avgRecall).toBeGreaterThanOrEqual(MIN_ACTION_ITEM_RECALL);
  });

  it("aggregate: decision recall above baseline", () => {
    expect(results.length).toBeGreaterThan(0);

    const avgRecall =
      results.reduce((sum, r) => sum + r.decisionRecall, 0) / results.length;

    console.log(`\n[RESULTS] Decision Recall: ${(avgRecall * 100).toFixed(1)}% (baseline: ${BASELINE_DECISION_RECALL * 100}%, min: ${MIN_DECISION_RECALL * 100}%)`);

    for (const r of results) {
      console.log(
        `  ${r.id}: ${(r.decisionRecall * 100).toFixed(0)}%` +
          (r.missedDecisions.length > 0
            ? ` — missed: ${r.missedDecisions.join("; ")}`
            : "")
      );
    }

    expect(avgRecall).toBeGreaterThanOrEqual(MIN_DECISION_RECALL);
  });
});
