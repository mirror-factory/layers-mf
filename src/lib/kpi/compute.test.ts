import { describe, it, expect } from "vitest";
import {
  evaluateThreshold,
  computeContextHealthKpis,
  computeAgentKpis,
  computeSourceKpis,
  computeHealthSummary,
  THRESHOLDS,
  type ContextHealthData,
  type AgentMetricsData,
} from "./compute";

// ---------------------------------------------------------------------------
// evaluateThreshold
// ---------------------------------------------------------------------------

describe("evaluateThreshold", () => {
  it("gte direction: pass when value >= pass threshold", () => {
    expect(evaluateThreshold(0.96, THRESHOLDS.pipeline_success_rate)).toBe("pass");
  });

  it("gte direction: warn when value between warn and pass", () => {
    expect(evaluateThreshold(0.90, THRESHOLDS.pipeline_success_rate)).toBe("warn");
  });

  it("gte direction: fail when value below warn", () => {
    expect(evaluateThreshold(0.50, THRESHOLDS.pipeline_success_rate)).toBe("fail");
  });

  it("lte direction: pass when value <= pass threshold", () => {
    expect(evaluateThreshold(0.03, THRESHOLDS.error_rate)).toBe("pass");
  });

  it("lte direction: warn when value between pass and warn", () => {
    expect(evaluateThreshold(0.10, THRESHOLDS.error_rate)).toBe("warn");
  });

  it("lte direction: fail when value above warn", () => {
    expect(evaluateThreshold(0.20, THRESHOLDS.error_rate)).toBe("fail");
  });

  it("boundary: exact pass value is pass (gte)", () => {
    expect(evaluateThreshold(0.95, THRESHOLDS.pipeline_success_rate)).toBe("pass");
  });

  it("boundary: exact pass value is pass (lte)", () => {
    expect(evaluateThreshold(0.05, THRESHOLDS.error_rate)).toBe("pass");
  });
});

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function makeContextHealth(overrides: Partial<ContextHealthData> = {}): ContextHealthData {
  return {
    pipeline: {
      total: 100,
      ready: 96,
      error: 4,
      pending: 0,
      processing: 0,
      success_rate: 0.96,
    },
    embedding_coverage: 1.0,
    content_completeness: 0.92,
    extraction_quality: {
      has_entities: 80,
      has_topics: 85,
      has_action_items: 40,
      has_people: 60,
      has_decisions: 30,
      ready_count: 96,
      topics_rate: 0.885,
    },
    freshness: {
      oldest_pending: null,
      newest_ready: new Date().toISOString(),
    },
    by_source: [
      { source_type: "google-drive", total: 50, ready: 48, error_count: 2, pending: 0, processing: 0, success_rate: 0.96 },
      { source_type: "slack", total: 30, ready: 29, error_count: 1, pending: 0, processing: 0, success_rate: 0.967 },
      { source_type: "upload", total: 20, ready: 19, error_count: 1, pending: 0, processing: 0, success_rate: 0.95 },
    ],
    ...overrides,
  };
}

function makeAgentMetrics(overrides: Partial<AgentMetricsData> = {}): AgentMetricsData {
  return {
    total_runs: 100,
    rates: {
      search_utilization: 0.93,
      no_tool: 0.02,
      error: 0.03,
      step_limit: 0.08,
      doc_retrieval: 0.45,
    },
    averages: {
      steps: 2.4,
      input_tokens: 3200,
      output_tokens: 800,
      duration_ms: 8500,
    },
    by_model: [
      { model: "anthropic/claude-haiku-4-5-20251001", runs: 60, avg_steps: 2.2, avg_duration_ms: 6000, errors: 1 },
      { model: "openai/gpt-4o-mini", runs: 40, avg_steps: 2.8, avg_duration_ms: 12000, errors: 2 },
    ],
    daily_trend: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeContextHealthKpis
// ---------------------------------------------------------------------------

describe("computeContextHealthKpis", () => {
  it("all pass for healthy data", () => {
    const kpis = computeContextHealthKpis(makeContextHealth());
    expect(kpis.every((k) => k.status === "pass")).toBe(true);
    expect(kpis).toHaveLength(5);
  });

  it("pipeline rate fails when too low", () => {
    const kpis = computeContextHealthKpis(
      makeContextHealth({ pipeline: { total: 100, ready: 50, error: 50, pending: 0, processing: 0, success_rate: 0.5 } })
    );
    const pipeline = kpis.find((k) => k.name === "Pipeline Success Rate")!;
    expect(pipeline.status).toBe("fail");
    expect(pipeline.value).toBe(0.5);
  });

  it("embedding coverage warns when below 1.0 but above 0.95", () => {
    const kpis = computeContextHealthKpis(makeContextHealth({ embedding_coverage: 0.97 }));
    const emb = kpis.find((k) => k.name === "Embedding Coverage")!;
    expect(emb.status).toBe("warn");
  });

  it("staleness fails when oldest_pending is old", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3_600_000).toISOString();
    const kpis = computeContextHealthKpis(
      makeContextHealth({ freshness: { oldest_pending: fiveHoursAgo, newest_ready: null } })
    );
    const stale = kpis.find((k) => k.name === "Processing Staleness")!;
    expect(stale.status).toBe("fail");
  });

  it("staleness passes when no pending items", () => {
    const kpis = computeContextHealthKpis(
      makeContextHealth({ freshness: { oldest_pending: null, newest_ready: null } })
    );
    const stale = kpis.find((k) => k.name === "Processing Staleness")!;
    expect(stale.status).toBe("pass");
    expect(stale.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSourceKpis
// ---------------------------------------------------------------------------

describe("computeSourceKpis", () => {
  it("returns one KPI per source", () => {
    const data = makeContextHealth();
    const kpis = computeSourceKpis(data.by_source);
    expect(kpis).toHaveLength(3);
    expect(kpis.every((k) => k.status === "pass")).toBe(true);
  });

  it("flags failing source", () => {
    const kpis = computeSourceKpis([
      { source_type: "broken", total: 10, ready: 3, error_count: 7, pending: 0, processing: 0, success_rate: 0.3 },
    ]);
    expect(kpis[0].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// computeAgentKpis
// ---------------------------------------------------------------------------

describe("computeAgentKpis", () => {
  it("all pass for healthy agent data", () => {
    const kpis = computeAgentKpis(makeAgentMetrics());
    const nonInfoKpis = kpis.filter((k) => k.name !== "Doc Retrieval Rate");
    expect(nonInfoKpis.every((k) => k.status === "pass")).toBe(true);
  });

  it("returns empty array when no runs", () => {
    const kpis = computeAgentKpis(makeAgentMetrics({ total_runs: 0 }));
    expect(kpis).toHaveLength(0);
  });

  it("error rate fails when too high", () => {
    const kpis = computeAgentKpis(
      makeAgentMetrics({
        rates: { search_utilization: 0.93, no_tool: 0.02, error: 0.25, step_limit: 0.08, doc_retrieval: 0.45 },
      })
    );
    const err = kpis.find((k) => k.name === "Error Rate")!;
    expect(err.status).toBe("fail");
  });

  it("search utilization warns when between thresholds", () => {
    const kpis = computeAgentKpis(
      makeAgentMetrics({
        rates: { search_utilization: 0.80, no_tool: 0.02, error: 0.03, step_limit: 0.08, doc_retrieval: 0.45 },
      })
    );
    const su = kpis.find((k) => k.name === "Search Utilization")!;
    expect(su.status).toBe("warn");
  });

  it("duration fails when too slow", () => {
    const kpis = computeAgentKpis(
      makeAgentMetrics({
        averages: { steps: 3, input_tokens: 5000, output_tokens: 1500, duration_ms: 30_000 },
      })
    );
    const dur = kpis.find((k) => k.name === "Avg Duration")!;
    expect(dur.status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// computeHealthSummary
// ---------------------------------------------------------------------------

describe("computeHealthSummary", () => {
  it("returns pass when all healthy", () => {
    const summary = computeHealthSummary(makeContextHealth(), makeAgentMetrics());
    expect(summary.status).toBe("pass");
    expect(summary.context.length).toBeGreaterThan(0);
    expect(summary.agent.length).toBeGreaterThan(0);
  });

  it("returns fail when any KPI fails", () => {
    const summary = computeHealthSummary(
      makeContextHealth({ pipeline: { total: 10, ready: 3, error: 7, pending: 0, processing: 0, success_rate: 0.3 } }),
      makeAgentMetrics()
    );
    expect(summary.status).toBe("fail");
  });

  it("returns warn when worst is warn", () => {
    const summary = computeHealthSummary(
      makeContextHealth({ embedding_coverage: 0.97 }),
      makeAgentMetrics()
    );
    expect(summary.status).toBe("warn");
  });
});
