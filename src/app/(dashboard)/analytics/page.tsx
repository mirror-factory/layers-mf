import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContextHealthPanel } from "./_components/context-health-panel";
import { AgentAnalyticsPanel } from "./_components/agent-analytics-panel";
import { RetrievalPanel } from "./_components/retrieval-panel";
import type { ContextHealthData, AgentMetricsData, IntegrationHealthItem } from "@/lib/kpi/compute";
import { computeHealthSummary } from "@/lib/kpi/compute";

interface AgentRun {
  id: string;
  created_at: string;
  model: string;
  query: string;
  step_count: number;
  finish_reason: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  duration_ms: number | null;
  tool_calls: { tool: string; count: number }[];
  error: string | null;
}

const STATUS_LABEL = {
  pass: "Healthy",
  warn: "Warning",
  fail: "Unhealthy",
} as const;

const STATUS_COLOR = {
  pass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  fail: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
} as const;

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberRow } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!memberRow) return null;

  const orgId = memberRow.org_id;

  // Fetch all data in parallel
  const [contextRes, integrationsRes, agentRes, runsRes] = await Promise.all([
    supabase.rpc("get_context_health", { p_org_id: orgId }),
    supabase.rpc("get_integration_health", { p_org_id: orgId }),
    supabase.rpc("get_agent_metrics", { p_org_id: orgId }),
    supabase
      .from("agent_runs")
      .select("id, created_at, model, query, step_count, finish_reason, total_input_tokens, total_output_tokens, duration_ms, tool_calls, error")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // If RPCs don't exist yet (migration not applied), show fallback
  const hasRpcData = !contextRes.error && !agentRes.error;

  const contextData = (contextRes.data ?? null) as unknown as ContextHealthData | null;
  const agentData = (agentRes.data ?? null) as unknown as AgentMetricsData | null;
  const integrations = (integrationsRes.data ?? []) as unknown as IntegrationHealthItem[];
  const runs = (runsRes.data ?? []) as AgentRun[];

  const summary = contextData && agentData
    ? computeHealthSummary(contextData, agentData)
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            KPIs and quality metrics for your organization.
          </p>
        </div>
        {summary && (
          <span className={`inline-flex items-center self-start rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[summary.status]}`}>
            {STATUS_LABEL[summary.status]}
          </span>
        )}
      </div>

      {!hasRpcData ? (
        // Fallback: show agent runs panel without KPI RPCs
        <AgentAnalyticsPanel
          agentData={{
            total_runs: runs.length,
            rates: { search_utilization: 0, no_tool: 0, error: 0, step_limit: 0, doc_retrieval: 0 },
            averages: { steps: 0, input_tokens: 0, output_tokens: 0, duration_ms: 0 },
            by_model: [],
            daily_trend: [],
          }}
          runs={runs}
        />
      ) : (
        <Tabs defaultValue="context" className="w-full">
          <TabsList className="grid w-full grid-cols-3 text-xs sm:text-sm">
            <TabsTrigger value="context">Context Health</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
          </TabsList>

          <TabsContent value="context" className="mt-6">
            {contextData && (
              <ContextHealthPanel data={contextData} integrations={integrations} />
            )}
          </TabsContent>

          <TabsContent value="agent" className="mt-6">
            {agentData && (
              <AgentAnalyticsPanel agentData={agentData} runs={runs} />
            )}
          </TabsContent>

          <TabsContent value="retrieval" className="mt-6">
            {contextData && <RetrievalPanel data={contextData} />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
