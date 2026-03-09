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
});
