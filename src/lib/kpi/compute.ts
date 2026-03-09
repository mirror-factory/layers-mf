/**
 * KPI computation library
 *
 * Pure TypeScript — defines thresholds, computes pass/warn/fail status
 * from Supabase RPC data. No DB dependency.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KpiStatus = "pass" | "warn" | "fail";

export interface KpiResult {
  name: string;
  value: number;
  target: number;
  unit: string;
  status: KpiStatus;
}

export interface ContextHealthData {
  pipeline: {
    total: number;
    ready: number;
    error: number;
    pending: number;
    processing: number;
    success_rate: number;
  };
  embedding_coverage: number;
  content_completeness: number;
  extraction_quality: {
    has_entities: number;
    has_topics: number;
    has_action_items: number;
    has_people: number;
    has_decisions: number;
    ready_count: number;
    topics_rate: number;
  };
  freshness: {
    oldest_pending: string | null;
    newest_ready: string | null;
  };
  by_source: Array<{
    source_type: string;
    total: number;
    ready: number;
    error_count: number;
    pending: number;
    processing: number;
    success_rate: number;
  }>;
}

export interface IntegrationHealthItem {
  provider: string;
  status: string;
  last_sync_at: string | null;
  hours_since_sync: number | null;
  item_count: number;
  error_count: number;
}

export interface AgentMetricsData {
  total_runs: number;
  rates: {
    search_utilization: number;
    no_tool: number;
    error: number;
    step_limit: number;
    doc_retrieval: number;
  };
  averages: {
    steps: number;
    input_tokens: number;
    output_tokens: number;
    duration_ms: number;
  };
  by_model: Array<{
    model: string;
    runs: number;
    avg_steps: number;
    avg_duration_ms: number;
    errors: number;
  }>;
  daily_trend: Array<{
    day: string;
    runs: number;
    errors: number;
    avg_duration_ms: number;
  }>;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

interface Threshold {
  pass: number;
  warn: number;
  /** "gte" = higher is better, "lte" = lower is better */
  direction: "gte" | "lte";
}

const THRESHOLDS = {
  pipeline_success_rate: { pass: 0.95, warn: 0.85, direction: "gte" },
  embedding_coverage: { pass: 1.0, warn: 0.95, direction: "gte" },
  content_completeness: { pass: 0.9, warn: 0.75, direction: "gte" },
  extraction_topics_rate: { pass: 0.8, warn: 0.6, direction: "gte" },
  processing_staleness_hours: { pass: 1, warn: 4, direction: "lte" },
  per_source_success_rate: { pass: 0.9, warn: 0.75, direction: "gte" },
  search_utilization: { pass: 0.9, warn: 0.75, direction: "gte" },
  no_tool_rate: { pass: 0.05, warn: 0.15, direction: "lte" },
  error_rate: { pass: 0.05, warn: 0.15, direction: "lte" },
  step_limit_rate: { pass: 0.1, warn: 0.25, direction: "lte" },
  avg_duration_ms: { pass: 15_000, warn: 25_000, direction: "lte" },
} as const satisfies Record<string, Threshold>;

export { THRESHOLDS };

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

export function evaluateThreshold(
  value: number,
  threshold: Threshold
): KpiStatus {
  if (threshold.direction === "gte") {
    if (value >= threshold.pass) return "pass";
    if (value >= threshold.warn) return "warn";
    return "fail";
  }
  // lte — lower is better
  if (value <= threshold.pass) return "pass";
  if (value <= threshold.warn) return "warn";
  return "fail";
}

// ---------------------------------------------------------------------------
// Context health KPIs
// ---------------------------------------------------------------------------

export function computeContextHealthKpis(
  data: ContextHealthData
): KpiResult[] {
  const stalenessHours = data.freshness.oldest_pending
    ? (Date.now() - new Date(data.freshness.oldest_pending).getTime()) /
      3_600_000
    : 0;

  return [
    {
      name: "Pipeline Success Rate",
      value: data.pipeline.success_rate,
      target: THRESHOLDS.pipeline_success_rate.pass,
      unit: "%",
      status: evaluateThreshold(
        data.pipeline.success_rate,
        THRESHOLDS.pipeline_success_rate
      ),
    },
    {
      name: "Embedding Coverage",
      value: data.embedding_coverage,
      target: THRESHOLDS.embedding_coverage.pass,
      unit: "%",
      status: evaluateThreshold(
        data.embedding_coverage,
        THRESHOLDS.embedding_coverage
      ),
    },
    {
      name: "Content Completeness",
      value: data.content_completeness,
      target: THRESHOLDS.content_completeness.pass,
      unit: "%",
      status: evaluateThreshold(
        data.content_completeness,
        THRESHOLDS.content_completeness
      ),
    },
    {
      name: "Extraction Quality (Topics)",
      value: data.extraction_quality.topics_rate,
      target: THRESHOLDS.extraction_topics_rate.pass,
      unit: "%",
      status: evaluateThreshold(
        data.extraction_quality.topics_rate,
        THRESHOLDS.extraction_topics_rate
      ),
    },
    {
      name: "Processing Staleness",
      value: stalenessHours,
      target: THRESHOLDS.processing_staleness_hours.pass,
      unit: "hours",
      status: evaluateThreshold(
        stalenessHours,
        THRESHOLDS.processing_staleness_hours
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Per-source KPIs
// ---------------------------------------------------------------------------

export function computeSourceKpis(
  sources: ContextHealthData["by_source"]
): KpiResult[] {
  return sources.map((s) => ({
    name: `${s.source_type} Success Rate`,
    value: s.success_rate,
    target: THRESHOLDS.per_source_success_rate.pass,
    unit: "%",
    status: evaluateThreshold(
      s.success_rate,
      THRESHOLDS.per_source_success_rate
    ),
  }));
}

// ---------------------------------------------------------------------------
// Agent KPIs
// ---------------------------------------------------------------------------

export function computeAgentKpis(data: AgentMetricsData): KpiResult[] {
  if (data.total_runs === 0) return [];

  return [
    {
      name: "Search Utilization",
      value: data.rates.search_utilization,
      target: THRESHOLDS.search_utilization.pass,
      unit: "%",
      status: evaluateThreshold(
        data.rates.search_utilization,
        THRESHOLDS.search_utilization
      ),
    },
    {
      name: "No-Tool Rate",
      value: data.rates.no_tool,
      target: THRESHOLDS.no_tool_rate.pass,
      unit: "%",
      status: evaluateThreshold(data.rates.no_tool, THRESHOLDS.no_tool_rate),
    },
    {
      name: "Error Rate",
      value: data.rates.error,
      target: THRESHOLDS.error_rate.pass,
      unit: "%",
      status: evaluateThreshold(data.rates.error, THRESHOLDS.error_rate),
    },
    {
      name: "Step Limit Rate",
      value: data.rates.step_limit,
      target: THRESHOLDS.step_limit_rate.pass,
      unit: "%",
      status: evaluateThreshold(
        data.rates.step_limit,
        THRESHOLDS.step_limit_rate
      ),
    },
    {
      name: "Avg Duration",
      value: data.averages.duration_ms,
      target: THRESHOLDS.avg_duration_ms.pass,
      unit: "ms",
      status: evaluateThreshold(
        data.averages.duration_ms,
        THRESHOLDS.avg_duration_ms
      ),
    },
    {
      name: "Doc Retrieval Rate",
      value: data.rates.doc_retrieval,
      target: 0, // tracked, no threshold
      unit: "%",
      status: "pass", // always pass — informational only
    },
  ];
}

// ---------------------------------------------------------------------------
// Overall health summary
// ---------------------------------------------------------------------------

export interface HealthSummary {
  status: KpiStatus;
  context: KpiResult[];
  sources: KpiResult[];
  agent: KpiResult[];
}

export function computeHealthSummary(
  contextData: ContextHealthData,
  agentData: AgentMetricsData
): HealthSummary {
  const context = computeContextHealthKpis(contextData);
  const sources = computeSourceKpis(contextData.by_source);
  const agent = computeAgentKpis(agentData);

  const all = [...context, ...sources, ...agent];
  const overall: KpiStatus = all.some((k) => k.status === "fail")
    ? "fail"
    : all.some((k) => k.status === "warn")
      ? "warn"
      : "pass";

  return { status: overall, context, sources, agent };
}
