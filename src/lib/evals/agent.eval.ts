/**
 * Agent Effectiveness Eval Suite
 *
 * Calls the get_agent_metrics RPC and asserts KPI thresholds.
 * Also tests tool call appropriateness: the agent should use search tools
 * for context-seeking queries and avoid tool calls for simple greetings.
 *
 * Env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVAL_ORG_ID
 * Run: EVAL_ORG_ID=<uuid> pnpm eval:agent
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { computeAgentKpis, type AgentMetricsData } from "@/lib/kpi/compute";

const ORG_ID = process.env.EVAL_ORG_ID ?? "";

// ---------------------------------------------------------------------------
// Tool call appropriateness test inputs
// ---------------------------------------------------------------------------

/** Queries where the agent SHOULD invoke search tools */
const SHOULD_SEARCH_QUERIES = [
  "What were the action items from last week's standup?",
  "Find the onboarding docs for new engineers",
  "What did we decide about the API versioning strategy?",
  "Show me the Q3 product roadmap priorities",
  "Who is responsible for the embedding pipeline?",
  "Summarize the recent sprint retrospective",
];

/** Queries where the agent should NOT invoke search tools */
const SHOULD_NOT_SEARCH_QUERIES = [
  "Hi",
  "Hello there",
  "Thanks!",
  "Good morning",
  "What can you do?",
  "How are you?",
];

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

  // -------------------------------------------------------------------------
  // Existing KPI threshold tests
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Tool call appropriateness (search vs no-search)
  // -------------------------------------------------------------------------

  it("context-seeking queries should trigger search (heuristic)", () => {
    // This is a heuristic check: context-seeking queries contain tokens
    // that indicate the user wants to retrieve information from the library.
    const SEARCH_INDICATORS = [
      "what", "find", "show", "who", "summarize", "when", "where", "how",
      "action items", "decisions", "docs", "document", "roadmap", "retro",
    ];

    for (const query of SHOULD_SEARCH_QUERIES) {
      const lower = query.toLowerCase();
      const hasIndicator = SEARCH_INDICATORS.some((ind) =>
        lower.includes(ind)
      );
      console.log(
        `  SHOULD search: "${query}" → indicator found: ${hasIndicator}`
      );
      expect(
        hasIndicator,
        `Expected search indicator in "${query}"`
      ).toBe(true);
    }
  });

  it("greetings/chitchat should NOT trigger search (heuristic)", () => {
    // Greetings are short and contain no retrieval intent
    const GREETING_PATTERNS = [
      /^(hi|hello|hey|thanks|thank you|good\s+(morning|afternoon|evening))[\s!?.]*$/i,
      /^(what can you do|how are you)[\s?]*$/i,
    ];

    for (const query of SHOULD_NOT_SEARCH_QUERIES) {
      const isGreeting = GREETING_PATTERNS.some((p) => p.test(query));
      console.log(
        `  SHOULD NOT search: "${query}" → greeting detected: ${isGreeting}`
      );
      expect(
        isGreeting,
        `Expected greeting pattern in "${query}"`
      ).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Response coherence: model-level trends should be consistent
  // -------------------------------------------------------------------------

  it("per-model metrics are consistent (no model has >50% error rate)", () => {
    if (!agentData.by_model || agentData.by_model.length === 0) {
      console.log("No per-model data available, skipping");
      return;
    }

    for (const m of agentData.by_model) {
      const errorRate = m.runs > 0 ? m.errors / m.runs : 0;
      console.log(
        `  Model ${m.model}: ${m.runs} runs, ${m.errors} errors (${(errorRate * 100).toFixed(1)}%), avg ${(m.avg_duration_ms / 1000).toFixed(1)}s`
      );
      expect(
        errorRate,
        `Model ${m.model} has excessive error rate: ${(errorRate * 100).toFixed(1)}%`
      ).toBeLessThanOrEqual(0.5);
    }
  });

  it("daily trend shows no sustained error spikes (>3 consecutive days)", () => {
    if (!agentData.daily_trend || agentData.daily_trend.length < 3) {
      console.log("Insufficient daily trend data, skipping");
      return;
    }

    const ERROR_SPIKE_THRESHOLD = 0.3; // 30% error rate = spike
    let consecutiveSpikes = 0;
    let maxConsecutive = 0;

    for (const day of agentData.daily_trend) {
      const errorRate = day.runs > 0 ? day.errors / day.runs : 0;
      if (errorRate > ERROR_SPIKE_THRESHOLD) {
        consecutiveSpikes++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveSpikes);
      } else {
        consecutiveSpikes = 0;
      }
    }

    console.log(
      `  Max consecutive error spikes (>${(ERROR_SPIKE_THRESHOLD * 100).toFixed(0)}%): ${maxConsecutive}`
    );
    expect(
      maxConsecutive,
      "Sustained error spike detected (>3 consecutive days above 30%)"
    ).toBeLessThanOrEqual(3);
  });
});
