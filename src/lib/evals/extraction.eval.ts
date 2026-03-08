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

  // Aggregate scoring
  it("aggregate: action item recall above baseline", () => {
    expect(results.length).toBeGreaterThan(0);

    const avgRecall =
      results.reduce((sum, r) => sum + r.actionItemRecall, 0) / results.length;

    console.log(`\n📊 Action Item Recall: ${(avgRecall * 100).toFixed(1)}% (baseline: ${BASELINE_ACTION_ITEM_RECALL * 100}%, min: ${MIN_ACTION_ITEM_RECALL * 100}%)`);

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

    console.log(`\n📊 Decision Recall: ${(avgRecall * 100).toFixed(1)}% (baseline: ${BASELINE_DECISION_RECALL * 100}%, min: ${MIN_DECISION_RECALL * 100}%)`);

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
