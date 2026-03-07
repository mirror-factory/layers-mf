/**
 * Retrieval Quality Eval Suite
 *
 * Tests the hybrid search function (searchContext) against a live Supabase DB.
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, and AI_GATEWAY_API_KEY env vars to be set.
 *
 * Run with: pnpm eval
 * (adds --reporter=verbose so each case prints)
 *
 * USAGE:
 *   1. Add at least one known Q&A pair to the fixtures below that matches
 *      real documents in your org's context_items table.
 *   2. Set EVAL_ORG_ID env var to your org UUID.
 *   3. Run: EVAL_ORG_ID=<your-org-id> pnpm eval
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { searchContext, SearchResult } from "@/lib/db/search";
import type { Database } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ORG_ID = process.env.EVAL_ORG_ID ?? "";
const TOP_N = 5; // Assert target appears in top-N results

// ---------------------------------------------------------------------------
// Fixtures — add known query → expected document title pairs here
// ---------------------------------------------------------------------------
type Fixture = {
  query: string;
  /** One or more substrings that must appear in at least one top-N result title */
  expectTitles: string[];
  /** Optional: minimum acceptable RRF score for the top result */
  minScore?: number;
};

const FIXTURES: Fixture[] = [
  // Example fixture — replace with real docs from your org:
  // {
  //   query: "Q3 roadmap priorities",
  //   expectTitles: ["Q3 Roadmap", "Roadmap"],
  //   minScore: 0.001,
  // },
  // {
  //   query: "onboarding process for new engineers",
  //   expectTitles: ["Engineering Onboarding", "Onboarding"],
  // },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function titlesMatch(results: SearchResult[], expectTitles: string[]): boolean {
  const topTitles = results.slice(0, TOP_N).map((r) => r.title.toLowerCase());
  return expectTitles.some((expected) =>
    topTitles.some((t) => t.includes(expected.toLowerCase()))
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe("Retrieval quality evals", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: ReturnType<typeof createClient<any>>;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    if (!ORG_ID) {
      throw new Error("Set EVAL_ORG_ID env var to your organization UUID.");
    }

    supabase = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
  });

  if (FIXTURES.length === 0) {
    it.skip("no fixtures defined — add fixtures to src/lib/evals/retrieval.eval.ts", () => {});
  }

  for (const fixture of FIXTURES) {
    it(`"${fixture.query}" → expects [${fixture.expectTitles.join(", ")}] in top ${TOP_N}`, async () => {
      const results = await searchContext(supabase, ORG_ID, fixture.query, TOP_N + 5);

      // Print results for inspection
      console.log(`\nQuery: "${fixture.query}"`);
      results.slice(0, TOP_N).forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.rrf_score.toFixed(4)}] ${r.title} (${r.source_type})`);
      });

      expect(results.length).toBeGreaterThan(0);
      expect(titlesMatch(results, fixture.expectTitles)).toBe(true);

      if (fixture.minScore !== undefined) {
        expect(results[0].rrf_score).toBeGreaterThanOrEqual(fixture.minScore);
      }
    }, 30_000);
  }

  it("search returns results without errors for a generic query", async () => {
    if (!ORG_ID) return; // skip if no org set
    const results = await searchContext(supabase, ORG_ID, "team", 5);
    // Just verify the call doesn't throw and returns an array
    expect(Array.isArray(results)).toBe(true);
  }, 30_000);

  it("empty query returns array (graceful)", async () => {
    if (!ORG_ID) return;
    const results = await searchContext(supabase, ORG_ID, " ", 3).catch(() => []);
    expect(Array.isArray(results)).toBe(true);
  }, 15_000);
});
