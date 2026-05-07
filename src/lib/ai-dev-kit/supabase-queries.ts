/**
 * Supabase Query Layer
 *
 * Typed query functions for all 15 ai-dev-kit tables.
 * Used by API routes and TelemetryIntegration to read/write observability data.
 *
 * Every function takes a SupabaseClient as its first argument so the caller
 * controls auth context (service-role for API routes, anon for client-side).
 */
import { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Row types  (match the SQL schema in 00001_ai_dev_kit_schema.sql)
// ---------------------------------------------------------------------------

export interface Trace {
  id: string;
  tenant_id: string;
  user_id: string | null;
  session_id: string | null;
  model: string | null;
  provider: string | null;
  total_tokens: number;
  total_cost: number;
  latency_ms: number | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Span {
  id: string;
  trace_id: string;
  parent_span_id: string | null;
  type: string;
  name: string;
  input: string | null;
  output: string | null;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  latency_ms: number | null;
  tool_name: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TraceWithSpans extends Trace {
  spans: Span[];
}

export interface ToolRegistryRow {
  id: string;
  tenant_id: string;
  name: string;
  version: string;
  description: string;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  category: string;
  cost_estimate: string | null;
  test_status: string;
  last_eval_score: number | null;
  permission_tier: string;
  created_at: string;
  updated_at: string;
}

export interface EvalSuiteRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvalRunRow {
  id: string;
  suite_id: string;
  tenant_id: string;
  provider: string | null;
  model: string | null;
  pass_rate: number | null;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  cost: number;
  created_at: string;
}

export interface EvalResultRow {
  id: string;
  run_id: string;
  tenant_id: string;
  case_name: string;
  status: string;
  input: string | null;
  expected: string | null;
  actual: string | null;
  score: number | null;
  trace_id: string | null;
  created_at: string;
}

export interface EvalRunWithResults extends EvalRunRow {
  results: EvalResultRow[];
  suite_name?: string;
}

export interface CostLogRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  tool_name: string | null;
  created_at: string;
}

export interface RegressionTestRow {
  id: string;
  tenant_id: string;
  source_trace_id: string | null;
  tool_name: string;
  error_pattern: string | null;
  test_file_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DeploymentSnapshotRow {
  id: string;
  tenant_id: string;
  deployment_id: string;
  env_var_hash: string | null;
  migration_version: string | null;
  eval_snapshot: Record<string, unknown> | null;
  tool_registry_hash: string | null;
  created_at: string;
}

export interface ConnectorStatusRow {
  id: string;
  tenant_id: string;
  connector_name: string;
  status: string;
  last_sync_at: string | null;
  error_count: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert types  (omit server-generated fields)
// ---------------------------------------------------------------------------

export interface InsertTrace {
  tenant_id: string;
  user_id?: string;
  session_id?: string;
  model?: string;
  provider?: string;
  total_tokens?: number;
  total_cost?: number;
  latency_ms?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface InsertSpan {
  trace_id: string;
  parent_span_id?: string;
  type: string;
  name: string;
  input?: string;
  output?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
  latency_ms?: number;
  tool_name?: string;
  error_message?: string;
  started_at?: string;
  ended_at?: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertTool {
  tenant_id: string;
  name: string;
  version?: string;
  description: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  category: string;
  cost_estimate?: string;
  test_status?: string;
  last_eval_score?: number;
  permission_tier?: string;
}

export interface InsertEvalRun {
  suite_id: string;
  tenant_id: string;
  provider?: string;
  model?: string;
  pass_rate?: number;
  total_cases?: number;
  passed_cases?: number;
  failed_cases?: number;
  cost?: number;
}

export interface InsertEvalResult {
  run_id: string;
  tenant_id: string;
  case_name: string;
  status: string;
  input?: string;
  expected?: string;
  actual?: string;
  score?: number;
  trace_id?: string;
}

export interface InsertCostLog {
  tenant_id: string;
  user_id?: string;
  provider: string;
  model: string;
  tokens_in?: number;
  tokens_out?: number;
  cost: number;
  tool_name?: string;
}

export interface InsertRegressionTest {
  tenant_id: string;
  source_trace_id?: string;
  tool_name: string;
  error_pattern?: string;
  test_file_path?: string;
  status?: string;
}

export interface InsertDeployment {
  tenant_id: string;
  deployment_id: string;
  env_var_hash?: string;
  migration_version?: string;
  eval_snapshot?: Record<string, unknown>;
  tool_registry_hash?: string;
}

export interface UpsertConnector {
  tenant_id: string;
  connector_name: string;
  status?: string;
  last_sync_at?: string;
  error_count?: number;
  config?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Aggregated types
// ---------------------------------------------------------------------------

export interface CostSummary {
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  entryCount: number;
  period: string;
}

export interface OverviewStats {
  totalCost: number;
  avgLatencyMs: number;
  evalPassRate: number;
  activeToolsCount: number;
  systemHealth: 'operational' | 'degraded' | 'down';
  traceCount: number;
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function throwOnError<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const err = result.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(result.error)}`);
  }
  return result.data as T;
}

// =========================================================================
// TRACES
// =========================================================================

export async function insertTrace(
  client: SupabaseClient,
  data: InsertTrace,
): Promise<Trace> {
  const result = await client
    .from('traces')
    .insert(data)
    .select()
    .single();
  return throwOnError<Trace>(result);
}

export async function getTraces(
  client: SupabaseClient,
  opts: { limit?: number; offset?: number; status?: string; model?: string } = {},
): Promise<Trace[]> {
  const { limit = 50, offset = 0, status, model } = opts;
  let query = client
    .from('traces')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (model) query = query.eq('model', model);

  const result = await query;
  return throwOnError<Trace[]>(result);
}

export async function getTraceById(
  client: SupabaseClient,
  id: string,
): Promise<Trace | null> {
  const result = await client
    .from('traces')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (result.error) {
    const err = result.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(result.error)}`);
  }
  return result.data as Trace | null;
}

export async function getTraceWithSpans(
  client: SupabaseClient,
  id: string,
): Promise<TraceWithSpans | null> {
  const trace = await getTraceById(client, id);
  if (!trace) return null;

  const spans = await getSpansByTraceId(client, id);
  return { ...trace, spans };
}

// =========================================================================
// SPANS
// =========================================================================

export async function insertSpan(
  client: SupabaseClient,
  data: InsertSpan,
): Promise<Span> {
  const result = await client
    .from('spans')
    .insert(data)
    .select()
    .single();
  return throwOnError<Span>(result);
}

export async function getSpansByTraceId(
  client: SupabaseClient,
  traceId: string,
): Promise<Span[]> {
  const result = await client
    .from('spans')
    .select('*')
    .eq('trace_id', traceId)
    .order('started_at', { ascending: true });
  return throwOnError<Span[]>(result);
}

// =========================================================================
// TOOL REGISTRY
// =========================================================================

export async function getToolRegistry(
  client: SupabaseClient,
): Promise<ToolRegistryRow[]> {
  const result = await client
    .from('tool_registry')
    .select('*')
    .order('name', { ascending: true });
  return throwOnError<ToolRegistryRow[]>(result);
}

export async function upsertTool(
  client: SupabaseClient,
  data: UpsertTool,
): Promise<ToolRegistryRow> {
  const result = await client
    .from('tool_registry')
    .upsert(data, { onConflict: 'tenant_id,name' })
    .select()
    .single();
  return throwOnError<ToolRegistryRow>(result);
}

// =========================================================================
// EVAL SUITES / RUNS / RESULTS
// =========================================================================

export async function getEvalSuites(
  client: SupabaseClient,
): Promise<EvalSuiteRow[]> {
  const result = await client
    .from('eval_suites')
    .select('*')
    .order('created_at', { ascending: false });
  return throwOnError<EvalSuiteRow[]>(result);
}

export async function getEvalRuns(
  client: SupabaseClient,
  suiteId?: string,
): Promise<EvalRunRow[]> {
  let query = client
    .from('eval_runs')
    .select('*')
    .order('created_at', { ascending: false });

  if (suiteId) query = query.eq('suite_id', suiteId);

  const result = await query;
  return throwOnError<EvalRunRow[]>(result);
}

export async function getEvalRunById(
  client: SupabaseClient,
  id: string,
): Promise<EvalRunWithResults | null> {
  const runResult = await client
    .from('eval_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (runResult.error) {
    const err = runResult.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(runResult.error)}`);
  }
  if (!runResult.data) return null;

  const run = runResult.data as EvalRunRow;

  // Fetch results for this run
  const resultsResult = await client
    .from('eval_results')
    .select('*')
    .eq('run_id', id)
    .order('created_at', { ascending: true });
  const results = throwOnError<EvalResultRow[]>(resultsResult);

  // Fetch suite name
  let suiteName: string | undefined;
  if (run.suite_id) {
    const suiteResult = await client
      .from('eval_suites')
      .select('name')
      .eq('id', run.suite_id)
      .maybeSingle();
    if (suiteResult.data) {
      suiteName = (suiteResult.data as { name: string }).name;
    }
  }

  return { ...run, results, suite_name: suiteName };
}

export async function insertEvalRun(
  client: SupabaseClient,
  data: InsertEvalRun,
): Promise<EvalRunRow> {
  const result = await client
    .from('eval_runs')
    .insert(data)
    .select()
    .single();
  return throwOnError<EvalRunRow>(result);
}

export async function insertEvalResult(
  client: SupabaseClient,
  data: InsertEvalResult,
): Promise<void> {
  const result = await client
    .from('eval_results')
    .insert(data);
  if (result.error) {
    const err = result.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(result.error)}`);
  }
}

// =========================================================================
// COST LOGS
// =========================================================================

export async function insertCostLog(
  client: SupabaseClient,
  data: InsertCostLog,
): Promise<void> {
  const result = await client
    .from('cost_logs')
    .insert(data);
  if (result.error) {
    const err = result.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(result.error)}`);
  }
}

export async function getCostSummary(
  client: SupabaseClient,
  opts: { period?: 'day' | 'week' | 'month' } = {},
): Promise<CostSummary> {
  const { period = 'month' } = opts;

  const now = new Date();
  let since: Date;
  switch (period) {
    case 'day':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
    default:
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const result = await client
    .from('cost_logs')
    .select('cost, tokens_in, tokens_out')
    .gte('created_at', since.toISOString());

  const rows = throwOnError<Array<{ cost: number; tokens_in: number; tokens_out: number }>>(result);

  let totalCost = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  for (const row of rows) {
    totalCost += Number(row.cost) || 0;
    totalTokensIn += row.tokens_in || 0;
    totalTokensOut += row.tokens_out || 0;
  }

  return {
    totalCost,
    totalTokensIn,
    totalTokensOut,
    entryCount: rows.length,
    period,
  };
}

export async function getCostByModel(
  client: SupabaseClient,
): Promise<Array<{ model: string; total: number }>> {
  // Supabase JS doesn't support GROUP BY directly, so we fetch recent logs
  // and aggregate in-memory. For large datasets, use an RPC function.
  const result = await client
    .from('cost_logs')
    .select('model, cost')
    .order('created_at', { ascending: false })
    .limit(5000);

  const rows = throwOnError<Array<{ model: string; cost: number }>>(result);

  const modelMap = new Map<string, number>();
  for (const row of rows) {
    const current = modelMap.get(row.model) ?? 0;
    modelMap.set(row.model, current + (Number(row.cost) || 0));
  }

  return Array.from(modelMap.entries())
    .map(([model, total]) => ({ model, total }))
    .sort((a, b) => b.total - a.total);
}

// =========================================================================
// REGRESSION TESTS
// =========================================================================

export async function getRegressionTests(
  client: SupabaseClient,
): Promise<RegressionTestRow[]> {
  const result = await client
    .from('regression_tests')
    .select('*')
    .order('created_at', { ascending: false });
  return throwOnError<RegressionTestRow[]>(result);
}

export async function insertRegressionTest(
  client: SupabaseClient,
  data: InsertRegressionTest,
): Promise<void> {
  const result = await client
    .from('regression_tests')
    .insert(data);
  if (result.error) {
    const err = result.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(result.error)}`);
  }
}

// =========================================================================
// DEPLOYMENTS
// =========================================================================

export async function getDeployments(
  client: SupabaseClient,
): Promise<DeploymentSnapshotRow[]> {
  const result = await client
    .from('deployment_snapshots')
    .select('*')
    .order('created_at', { ascending: false });
  return throwOnError<DeploymentSnapshotRow[]>(result);
}

export async function insertDeploymentSnapshot(
  client: SupabaseClient,
  data: InsertDeployment,
): Promise<void> {
  const result = await client
    .from('deployment_snapshots')
    .insert(data);
  if (result.error) {
    const err = result.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(result.error)}`);
  }
}

// =========================================================================
// CONNECTORS
// =========================================================================

export async function getConnectorStatuses(
  client: SupabaseClient,
): Promise<ConnectorStatusRow[]> {
  const result = await client
    .from('connector_status')
    .select('*')
    .order('connector_name', { ascending: true });
  return throwOnError<ConnectorStatusRow[]>(result);
}

export async function upsertConnectorStatus(
  client: SupabaseClient,
  data: UpsertConnector,
): Promise<void> {
  const result = await client
    .from('connector_status')
    .upsert(data, { onConflict: 'tenant_id,connector_name' });
  if (result.error) {
    const err = result.error as { message?: string };
    throw new Error(`Supabase query error: ${err.message ?? JSON.stringify(result.error)}`);
  }
}

// =========================================================================
// OVERVIEW (aggregated from multiple tables)
// =========================================================================

export async function getOverviewStats(
  client: SupabaseClient,
): Promise<OverviewStats> {
  // Run queries in parallel for performance
  const [costResult, tracesResult, evalRunsResult, toolsResult, connectorsResult] =
    await Promise.all([
      // Total cost for the past 30 days
      getCostSummary(client, { period: 'month' }).catch(() => ({
        totalCost: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        entryCount: 0,
        period: 'month' as const,
      })),

      // Recent traces for latency calculation
      client
        .from('traces')
        .select('latency_ms')
        .not('latency_ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100),

      // Recent eval runs for pass rate
      client
        .from('eval_runs')
        .select('pass_rate')
        .not('pass_rate', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50),

      // Active tools count
      client
        .from('tool_registry')
        .select('id', { count: 'exact', head: true }),

      // Connector statuses for system health
      client
        .from('connector_status')
        .select('status'),
    ]);

  // Total cost
  const totalCost = costResult.totalCost;

  // Average latency
  const traces = (tracesResult.data ?? []) as Array<{ latency_ms: number }>;
  const avgLatencyMs =
    traces.length > 0
      ? traces.reduce((sum, t) => sum + (t.latency_ms || 0), 0) / traces.length
      : 0;

  // Eval pass rate (average of recent runs)
  const evalRuns = (evalRunsResult.data ?? []) as Array<{ pass_rate: number }>;
  const evalPassRate =
    evalRuns.length > 0
      ? evalRuns.reduce((sum, r) => sum + (Number(r.pass_rate) || 0), 0) / evalRuns.length
      : 0;

  // Active tools count
  const activeToolsCount = toolsResult.count ?? 0;

  // Trace count
  const traceCountResult = await client
    .from('traces')
    .select('id', { count: 'exact', head: true });
  const traceCount = traceCountResult.count ?? 0;

  // System health: degraded if any connector is degraded, down if any is disconnected
  const connectors = (connectorsResult.data ?? []) as Array<{ status: string }>;
  let systemHealth: 'operational' | 'degraded' | 'down' = 'operational';
  for (const c of connectors) {
    if (c.status === 'disconnected') {
      systemHealth = 'down';
      break;
    }
    if (c.status === 'degraded') {
      systemHealth = 'degraded';
    }
  }

  return {
    totalCost,
    avgLatencyMs,
    evalPassRate,
    activeToolsCount,
    systemHealth,
    traceCount,
  };
}
