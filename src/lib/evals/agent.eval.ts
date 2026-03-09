/**
 * Agent Effectiveness Eval Suite
 *
 * Calls the get_agent_metrics RPC and asserts KPI thresholds.
 *
 * Env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVAL_ORG_ID
 * Run: EVAL_ORG_ID=<uuid> pnpm eval:agent
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { computeAgentKpis, type AgentMetricsData } from "@/lib/kpi/compute";

const ORG_ID = process.env.EVAL_ORG_ID ?? "";

describe("Agent effectiveness evals", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: ReturnType<typeof createClient<any>>;
  let agentData: AgentMetricsData;

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
    const { data, error } = await (supabase as any).rpc("get_agent_metrics", {
      p_org_id: ORG_ID,
    });
    if (error) throw new Error(`RPC failed: ${error.message}`);
    agentData = data as AgentMetricsData;

    console.log("\nAgent Metrics Data:");
    console.log(JSON.stringify(agentData, null, 2));
  }, 30_000);

  it("has runs to evaluate", () => {
    console.log(`Total runs: ${agentData.total_runs}`);
    expect(agentData.total_runs).toBeGreaterThan(0);
  });

  it("search utilization >= 90%", () => {
    const kpis = computeAgentKpis(agentData);
    const su = kpis.find((k) => k.name === "Search Utilization")!;
    console.log(
      `Search Utilization: ${(su.value * 100).toFixed(1)}% [${su.status}]`
    );
    expect(su.status).not.toBe("fail");
  });

  it("no-tool rate <= 5%", () => {
    const kpis = computeAgentKpis(agentData);
    const nt = kpis.find((k) => k.name === "No-Tool Rate")!;
    console.log(
      `No-Tool Rate: ${(nt.value * 100).toFixed(1)}% [${nt.status}]`
    );
    expect(nt.status).not.toBe("fail");
  });

  it("error rate <= 5%", () => {
    const kpis = computeAgentKpis(agentData);
    const err = kpis.find((k) => k.name === "Error Rate")!;
    console.log(
      `Error Rate: ${(err.value * 100).toFixed(1)}% [${err.status}]`
    );
    expect(err.status).not.toBe("fail");
  });

  it("step limit rate <= 10%", () => {
    const kpis = computeAgentKpis(agentData);
    const sl = kpis.find((k) => k.name === "Step Limit Rate")!;
    console.log(
      `Step Limit Rate: ${(sl.value * 100).toFixed(1)}% [${sl.status}]`
    );
    expect(sl.status).not.toBe("fail");
  });

  it("avg duration <= 15s", () => {
    const kpis = computeAgentKpis(agentData);
    const dur = kpis.find((k) => k.name === "Avg Duration")!;
    console.log(
      `Avg Duration: ${(dur.value / 1000).toFixed(1)}s [${dur.status}]`
    );
    expect(dur.status).not.toBe("fail");
  });
});
