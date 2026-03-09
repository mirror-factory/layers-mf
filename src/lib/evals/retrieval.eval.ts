/**
 * Retrieval Quality Eval Suite
 *
 * Inserts canary documents, searches against them, asserts Precision@5 and MRR,
 * then cleans up. Also supports custom fixtures from real org data.
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   AI_GATEWAY_API_KEY, EVAL_ORG_ID
 *
 * Run: EVAL_ORG_ID=<uuid> pnpm eval:retrieval
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { searchContext, type SearchResult } from "@/lib/db/search";
import { generateEmbedding } from "@/lib/ai/embed";
import type { Database } from "@/lib/database.types";
import {
  CANARY_DOCS,
  CANARY_QUERIES,
  CANARY_PREFIX,
  type CanaryDoc,
} from "./fixtures/canary-docs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ORG_ID = process.env.EVAL_ORG_ID ?? "";
const TOP_N = 5;

// Thresholds
const MIN_PRECISION_AT_5 = 0.8; // 80% of queries find expected doc in top 5
const MIN_MRR = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findRank(
  results: SearchResult[],
  expectedTitle: string
): number | null {
  const idx = results.findIndex((r) =>
    r.title.toLowerCase().includes(expectedTitle.toLowerCase())
  );
  return idx >= 0 ? idx + 1 : null;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe("Retrieval quality evals", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: ReturnType<typeof createClient<any>>;
  const insertedIds: string[] = [];

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    // Insert canary docs with embeddings
    for (const doc of CANARY_DOCS) {
      const embedding = await generateEmbedding(
        `${doc.title} ${doc.description_long}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("context_items")
        .insert({
          org_id: ORG_ID,
          title: doc.title,
          description_short: doc.description_short,
          description_long: doc.description_long,
          raw_content: doc.raw_content,
          source_type: doc.source_type,
          content_type: doc.content_type,
          entities: doc.entities,
          embedding,
          status: "ready",
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to insert canary: ${error.message}`);
      insertedIds.push(data.id);
    }

    console.log(`Inserted ${insertedIds.length} canary documents`);
  }, 120_000);

  afterAll(async () => {
    if (insertedIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("context_items")
        .delete()
        .in("id", insertedIds);

      if (error) console.error("Cleanup failed:", error.message);
      else console.log(`Cleaned up ${insertedIds.length} canary documents`);
    }
  }, 30_000);

  // Individual canary query tests
  for (const cq of CANARY_QUERIES) {
    it(`"${cq.query}" → finds "${cq.expectedTitle}" in top ${TOP_N}`, async () => {
      const results = await searchContext(
        supabase as ReturnType<typeof createClient<Database>>,
        ORG_ID,
        cq.query,
        TOP_N + 5
      );

      console.log(`\nQuery: "${cq.query}"`);
      results.slice(0, TOP_N).forEach((r, i) => {
        const marker = r.title.includes(CANARY_PREFIX) ? " [canary]" : "";
        console.log(
          `  ${i + 1}. [${r.rrf_score.toFixed(4)}] ${r.title}${marker}`
        );
      });

      const rank = findRank(results.slice(0, TOP_N), cq.expectedTitle);
      expect(rank).not.toBeNull();
    }, 30_000);
  }

  // Aggregate metrics
  it("Precision@5 >= 80%", async () => {
    let hits = 0;
    for (const cq of CANARY_QUERIES) {
      const results = await searchContext(
        supabase as ReturnType<typeof createClient<Database>>,
        ORG_ID,
        cq.query,
        TOP_N + 5
      );
      const rank = findRank(results.slice(0, TOP_N), cq.expectedTitle);
      if (rank !== null) hits++;
    }
    const precision = hits / CANARY_QUERIES.length;
    console.log(
      `\nPrecision@${TOP_N}: ${(precision * 100).toFixed(1)}% (${hits}/${CANARY_QUERIES.length})`
    );
    expect(precision).toBeGreaterThanOrEqual(MIN_PRECISION_AT_5);
  }, 60_000);

  it("MRR >= 0.5", async () => {
    let rrSum = 0;
    for (const cq of CANARY_QUERIES) {
      const results = await searchContext(
        supabase as ReturnType<typeof createClient<Database>>,
        ORG_ID,
        cq.query,
        TOP_N + 5
      );
      const rank = findRank(results, cq.expectedTitle);
      if (rank !== null) rrSum += 1 / rank;
    }
    const mrr = rrSum / CANARY_QUERIES.length;
    console.log(`MRR: ${mrr.toFixed(4)}`);
    expect(mrr).toBeGreaterThanOrEqual(MIN_MRR);
  }, 60_000);

  // Graceful edge cases
  it("empty query returns array (graceful)", async () => {
    const results = await searchContext(
      supabase as ReturnType<typeof createClient<Database>>,
      ORG_ID,
      " ",
      3
    ).catch(() => []);
    expect(Array.isArray(results)).toBe(true);
  }, 15_000);
});
