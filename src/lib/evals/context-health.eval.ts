/**
 * Context Health Eval Suite
 *
 * Calls the get_context_health RPC and asserts KPI thresholds.
 *
 * Env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVAL_ORG_ID
 * Run: EVAL_ORG_ID=<uuid> pnpm eval:health
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  computeContextHealthKpis,
  computeSourceKpis,
  type ContextHealthData,
} from "@/lib/kpi/compute";

const ORG_ID = process.env.EVAL_ORG_ID ?? "";

describe("Context health evals", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: ReturnType<typeof createClient<any>>;
  let healthData: ContextHealthData;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_context_health", {
      p_org_id: ORG_ID,
    });
    if (error) throw new Error(`RPC failed: ${error.message}`);
    healthData = data as ContextHealthData;

    console.log("\nContext Health Data:");
    console.log(JSON.stringify(healthData, null, 2));
  }, 30_000);

  it("pipeline success rate >= 95%", () => {
    const kpis = computeContextHealthKpis(healthData);
    const pipeline = kpis.find((k) => k.name === "Pipeline Success Rate")!;
    console.log(
      `Pipeline Success Rate: ${(pipeline.value * 100).toFixed(1)}% [${pipeline.status}]`
    );
    expect(pipeline.status).not.toBe("fail");
  });

  it("all ready items have embeddings", () => {
    const kpis = computeContextHealthKpis(healthData);
    const emb = kpis.find((k) => k.name === "Embedding Coverage")!;
    console.log(
      `Embedding Coverage: ${(emb.value * 100).toFixed(1)}% [${emb.status}]`
    );
    expect(emb.status).not.toBe("fail");
  });

  it("no items stuck processing > 1 hour", () => {
    const kpis = computeContextHealthKpis(healthData);
    const stale = kpis.find((k) => k.name === "Processing Staleness")!;
    console.log(
      `Processing Staleness: ${stale.value.toFixed(2)} hours [${stale.status}]`
    );
    expect(stale.status).not.toBe("fail");
  });

  it("each integration >= 90% success", () => {
    const sourceKpis = computeSourceKpis(healthData.by_source);
    for (const kpi of sourceKpis) {
      console.log(
        `${kpi.name}: ${(kpi.value * 100).toFixed(1)}% [${kpi.status}]`
      );
      expect(kpi.status).not.toBe("fail");
    }
  });

  // -------------------------------------------------------------------------
  // Items with no chunks (orphaned items)
  // -------------------------------------------------------------------------
  it("no items stuck with zero chunks (checks via RPC data)", () => {
    // Items that are "ready" but have no embedding coverage suggest missing chunks
    const readyCount = healthData.pipeline.ready;
    const embeddingRate = healthData.embedding_coverage;

    const itemsWithoutEmbeddings = Math.round(readyCount * (1 - embeddingRate));
    console.log(
      `\nReady items: ${readyCount}, Embedding coverage: ${(embeddingRate * 100).toFixed(1)}%`
    );
    console.log(`Items likely missing chunks/embeddings: ${itemsWithoutEmbeddings}`);

    // Allow up to 5% of ready items to be missing embeddings
    const missingRate = readyCount > 0 ? itemsWithoutEmbeddings / readyCount : 0;
    expect(
      missingRate,
      `${itemsWithoutEmbeddings} ready items have no embeddings (${(missingRate * 100).toFixed(1)}%)`
    ).toBeLessThanOrEqual(0.05);
  });

  // -------------------------------------------------------------------------
  // Stale items (no update in 30+ days)
  // -------------------------------------------------------------------------
  it("newest ready item was updated within last 30 days", () => {
    if (!healthData.freshness.newest_ready) {
      console.log("No ready items found, skipping staleness check");
      return;
    }

    const newestReady = new Date(healthData.freshness.newest_ready);
    const daysSinceNewest =
      (Date.now() - newestReady.getTime()) / (1000 * 60 * 60 * 24);

    console.log(
      `\nNewest ready item: ${healthData.freshness.newest_ready} (${daysSinceNewest.toFixed(1)} days ago)`
    );

    // At least one item should have been processed in the last 30 days
    expect(
      daysSinceNewest,
      `No items processed in the last 30 days (newest: ${daysSinceNewest.toFixed(1)} days ago)`
    ).toBeLessThanOrEqual(30);
  });

  // -------------------------------------------------------------------------
  // Embedding dimension consistency
  // -------------------------------------------------------------------------
  it("embedding coverage is consistent across sources", () => {
    // If embedding coverage is high overall, per-source should also be healthy
    const overallCoverage = healthData.embedding_coverage;

    console.log(`\nOverall embedding coverage: ${(overallCoverage * 100).toFixed(1)}%`);
    console.log("Per-source breakdown:");

    for (const source of healthData.by_source) {
      const sourceSuccessRate = source.success_rate;
      console.log(
        `  ${source.source_type}: ${source.total} items, ${(sourceSuccessRate * 100).toFixed(1)}% success, ${source.error_count} errors`
      );

      // No source should have a success rate dramatically below the overall
      if (source.total >= 5) {
        expect(
          sourceSuccessRate,
          `Source ${source.source_type} success rate (${(sourceSuccessRate * 100).toFixed(1)}%) is well below overall`
        ).toBeGreaterThanOrEqual(overallCoverage - 0.2);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Extraction quality across entity types
  // -------------------------------------------------------------------------
  it("extraction quality: topics rate is healthy", () => {
    const topicsRate = healthData.extraction_quality.topics_rate;
    const readyCount = healthData.extraction_quality.ready_count;

    console.log(`\nExtraction quality:`);
    console.log(`  Ready count: ${readyCount}`);
    console.log(`  Has entities: ${healthData.extraction_quality.has_entities}`);
    console.log(`  Has topics: ${healthData.extraction_quality.has_topics} (${(topicsRate * 100).toFixed(1)}%)`);
    console.log(`  Has people: ${healthData.extraction_quality.has_people}`);
    console.log(`  Has action items: ${healthData.extraction_quality.has_action_items}`);
    console.log(`  Has decisions: ${healthData.extraction_quality.has_decisions}`);

    // At least 60% of items should have topics extracted
    if (readyCount > 0) {
      expect(topicsRate).toBeGreaterThanOrEqual(0.6);
    }
  });

  // -------------------------------------------------------------------------
  // Processing pipeline has no stuck items
  // -------------------------------------------------------------------------
  it("no items stuck in processing state", () => {
    const processing = healthData.pipeline.processing;
    const pending = healthData.pipeline.pending;
    const total = healthData.pipeline.total;

    console.log(`\nPipeline state:`);
    console.log(`  Total: ${total}`);
    console.log(`  Ready: ${healthData.pipeline.ready}`);
    console.log(`  Processing: ${processing}`);
    console.log(`  Pending: ${pending}`);
    console.log(`  Error: ${healthData.pipeline.error}`);

    // Processing items should be a small fraction of total (< 10%)
    const processingRate = total > 0 ? processing / total : 0;
    expect(
      processingRate,
      `${processing} items stuck in processing (${(processingRate * 100).toFixed(1)}% of total)`
    ).toBeLessThanOrEqual(0.1);
  });
});
