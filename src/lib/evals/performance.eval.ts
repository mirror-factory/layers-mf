/**
 * Performance Benchmarks Eval Suite
 *
 * Measures latency and throughput for key API endpoints and search functions.
 * Asserts that response times stay within defined thresholds.
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   AI_GATEWAY_API_KEY, EVAL_ORG_ID
 *
 * Run: EVAL_ORG_ID=<uuid> pnpm eval:performance
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  searchContext,
  searchContextChunks,
  type SearchResult,
} from "@/lib/db/search";
import { generateEmbedding } from "@/lib/ai/embed";
import type { Database } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ORG_ID = process.env.EVAL_ORG_ID ?? "";

// Latency targets (milliseconds)
const TARGETS = {
  /** Single search query (item-level) */
  searchItem: { p50: 2_000, p95: 5_000, max: 10_000 },
  /** Single search query (chunk-level) */
  searchChunk: { p50: 3_000, p95: 6_000, max: 12_000 },
  /** Embedding generation for a single query */
  embedding: { p50: 500, p95: 1_500, max: 3_000 },
  /** Supabase RPC round-trip (simple query) */
  rpcRoundTrip: { p50: 500, p95: 2_000, max: 5_000 },
};

// Test queries of varying complexity
const BENCHMARK_QUERIES = [
  "product roadmap Q3 priorities",
  "What were the action items from the last sprint?",
  "onboarding",
  "embedding pipeline error rate production incident postmortem",
  "How do I set up the local development environment?",
  "authentication SSO SAML integration requirements",
  "team retrospective wins challenges",
  "API versioning strategy",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface LatencyResult {
  query: string;
  ms: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function summarize(label: string, latencies: LatencyResult[]): {
  p50: number;
  p95: number;
  max: number;
  avg: number;
} {
  const sorted = latencies.map((l) => l.ms).sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const max = sorted[sorted.length - 1] ?? 0;
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;

  console.log(`\n${label}:`);
  console.log(`  Samples: ${sorted.length}`);
  console.log(`  P50:     ${p50.toFixed(0)}ms`);
  console.log(`  P95:     ${p95.toFixed(0)}ms`);
  console.log(`  Max:     ${max.toFixed(0)}ms`);
  console.log(`  Avg:     ${avg.toFixed(0)}ms`);

  return { p50, p95, max, avg };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Performance benchmarks", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: ReturnType<typeof createClient<any>>;

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
  }, 15_000);

  // -------------------------------------------------------------------------
  // Embedding generation latency
  // -------------------------------------------------------------------------
  it("embedding generation latency within targets", async () => {
    const latencies: LatencyResult[] = [];

    for (const query of BENCHMARK_QUERIES) {
      const start = performance.now();
      await generateEmbedding(query);
      const elapsed = performance.now() - start;
      latencies.push({ query, ms: elapsed });
    }

    const stats = summarize("Embedding Generation", latencies);

    expect(
      stats.p50,
      `Embedding P50 (${stats.p50.toFixed(0)}ms) exceeds target (${TARGETS.embedding.p50}ms)`
    ).toBeLessThanOrEqual(TARGETS.embedding.p50);

    expect(
      stats.p95,
      `Embedding P95 (${stats.p95.toFixed(0)}ms) exceeds target (${TARGETS.embedding.p95}ms)`
    ).toBeLessThanOrEqual(TARGETS.embedding.p95);

    expect(
      stats.max,
      `Embedding max (${stats.max.toFixed(0)}ms) exceeds target (${TARGETS.embedding.max}ms)`
    ).toBeLessThanOrEqual(TARGETS.embedding.max);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Item-level search latency
  // -------------------------------------------------------------------------
  it("item-level search latency within targets", async () => {
    const latencies: LatencyResult[] = [];

    for (const query of BENCHMARK_QUERIES) {
      const start = performance.now();
      await searchContext(
        supabase as ReturnType<typeof createClient<Database>>,
        ORG_ID,
        query,
        10
      );
      const elapsed = performance.now() - start;
      latencies.push({ query, ms: elapsed });
    }

    const stats = summarize("Item-Level Search", latencies);

    expect(
      stats.p50,
      `Search P50 (${stats.p50.toFixed(0)}ms) exceeds target (${TARGETS.searchItem.p50}ms)`
    ).toBeLessThanOrEqual(TARGETS.searchItem.p50);

    expect(
      stats.p95,
      `Search P95 (${stats.p95.toFixed(0)}ms) exceeds target (${TARGETS.searchItem.p95}ms)`
    ).toBeLessThanOrEqual(TARGETS.searchItem.p95);

    expect(
      stats.max,
      `Search max (${stats.max.toFixed(0)}ms) exceeds target (${TARGETS.searchItem.max}ms)`
    ).toBeLessThanOrEqual(TARGETS.searchItem.max);
  }, 120_000);

  // -------------------------------------------------------------------------
  // Chunk-level search latency
  // -------------------------------------------------------------------------
  it("chunk-level search latency within targets", async () => {
    const latencies: LatencyResult[] = [];

    for (const query of BENCHMARK_QUERIES) {
      const start = performance.now();
      await searchContextChunks(
        supabase as ReturnType<typeof createClient<Database>>,
        ORG_ID,
        query,
        10
      );
      const elapsed = performance.now() - start;
      latencies.push({ query, ms: elapsed });
    }

    const stats = summarize("Chunk-Level Search", latencies);

    expect(
      stats.p50,
      `Chunk search P50 (${stats.p50.toFixed(0)}ms) exceeds target (${TARGETS.searchChunk.p50}ms)`
    ).toBeLessThanOrEqual(TARGETS.searchChunk.p50);

    expect(
      stats.p95,
      `Chunk search P95 (${stats.p95.toFixed(0)}ms) exceeds target (${TARGETS.searchChunk.p95}ms)`
    ).toBeLessThanOrEqual(TARGETS.searchChunk.p95);
  }, 120_000);

  // -------------------------------------------------------------------------
  // RPC round-trip latency (context health as proxy)
  // -------------------------------------------------------------------------
  it("RPC round-trip latency within targets", async () => {
    const latencies: LatencyResult[] = [];

    // Run the same RPC multiple times to measure consistency
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("get_context_health", {
        p_org_id: ORG_ID,
      });
      const elapsed = performance.now() - start;
      latencies.push({ query: `rpc-call-${i + 1}`, ms: elapsed });
    }

    const stats = summarize("RPC Round-Trip (get_context_health)", latencies);

    expect(
      stats.p50,
      `RPC P50 (${stats.p50.toFixed(0)}ms) exceeds target (${TARGETS.rpcRoundTrip.p50}ms)`
    ).toBeLessThanOrEqual(TARGETS.rpcRoundTrip.p50);

    expect(
      stats.p95,
      `RPC P95 (${stats.p95.toFixed(0)}ms) exceeds target (${TARGETS.rpcRoundTrip.p95}ms)`
    ).toBeLessThanOrEqual(TARGETS.rpcRoundTrip.p95);
  }, 30_000);

  // -------------------------------------------------------------------------
  // Search with filters should not add significant overhead
  // -------------------------------------------------------------------------
  it("filtered search has acceptable overhead vs unfiltered", async () => {
    const query = "product roadmap priorities";

    // Unfiltered
    const unfilteredTimes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await searchContext(
        supabase as ReturnType<typeof createClient<Database>>,
        ORG_ID,
        query,
        10
      );
      unfilteredTimes.push(performance.now() - start);
    }

    // Filtered
    const filteredTimes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await searchContext(
        supabase as ReturnType<typeof createClient<Database>>,
        ORG_ID,
        query,
        10,
        { sourceType: "upload", contentType: "document" }
      );
      filteredTimes.push(performance.now() - start);
    }

    const avgUnfiltered =
      unfilteredTimes.reduce((s, v) => s + v, 0) / unfilteredTimes.length;
    const avgFiltered =
      filteredTimes.reduce((s, v) => s + v, 0) / filteredTimes.length;

    console.log(`\nFilter overhead:`);
    console.log(`  Unfiltered avg: ${avgUnfiltered.toFixed(0)}ms`);
    console.log(`  Filtered avg:   ${avgFiltered.toFixed(0)}ms`);
    console.log(
      `  Overhead:       ${(avgFiltered - avgUnfiltered).toFixed(0)}ms (${(((avgFiltered / avgUnfiltered) - 1) * 100).toFixed(1)}%)`
    );

    // Filtered search should not be more than 2x slower
    expect(
      avgFiltered,
      `Filtered search (${avgFiltered.toFixed(0)}ms) is more than 2x slower than unfiltered (${avgUnfiltered.toFixed(0)}ms)`
    ).toBeLessThanOrEqual(avgUnfiltered * 2 + 500); // +500ms tolerance for variance
  }, 60_000);

  // -------------------------------------------------------------------------
  // Concurrent search throughput
  // -------------------------------------------------------------------------
  it("concurrent searches complete within acceptable time", async () => {
    const CONCURRENT = 5;
    const queries = BENCHMARK_QUERIES.slice(0, CONCURRENT);

    const start = performance.now();
    const results = await Promise.all(
      queries.map((q) =>
        searchContext(
          supabase as ReturnType<typeof createClient<Database>>,
          ORG_ID,
          q,
          10
        )
      )
    );
    const totalTime = performance.now() - start;

    console.log(`\nConcurrent search (${CONCURRENT} queries):`);
    console.log(`  Total wall time: ${totalTime.toFixed(0)}ms`);
    console.log(
      `  Avg per query:   ${(totalTime / CONCURRENT).toFixed(0)}ms`
    );
    console.log(`  All returned results: ${results.every((r) => r.length >= 0)}`);

    // Concurrent batch should complete within 2x single-query target
    expect(
      totalTime,
      `Concurrent search took ${totalTime.toFixed(0)}ms (expected < ${TARGETS.searchItem.max * 2}ms)`
    ).toBeLessThanOrEqual(TARGETS.searchItem.max * 2);
  }, 60_000);
});
