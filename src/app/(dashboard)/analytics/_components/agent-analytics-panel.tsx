import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiGrid } from "./kpi-card";
import { computeAgentKpis, type AgentMetricsData } from "@/lib/kpi/compute";

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

function ModelBadge({ model }: { model: string }) {
  const short = model.split("/")[1] ?? model;
  const colors: Record<string, string> = {
    "claude-haiku-4-5-20251001": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "claude-sonnet-4.5": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    "claude-opus-4.6": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "gpt-4o-mini": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "gpt-4o": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    "gemini-flash": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "gemini-pro": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[short] ?? "bg-muted text-muted-foreground"}`}>
      {short}
    </span>
  );
}

interface Props {
  agentData: AgentMetricsData;
  runs: AgentRun[];
}

export function AgentAnalyticsPanel({ agentData, runs }: Props) {
  const kpis = computeAgentKpis(agentData);

  // Model breakdown from raw runs
  const byModel: Record<string, number> = {};
  for (const r of runs) {
    const short = r.model.split("/")[1] ?? r.model;
    byModel[short] = (byModel[short] ?? 0) + 1;
  }
  const modelRows = Object.entries(byModel).sort((a, b) => b[1] - a[1]);

  // Step distribution
  const stepBuckets: Record<string, number> = {};
  for (const r of runs) {
    const bucket = `${r.step_count} step${r.step_count !== 1 ? "s" : ""}`;
    stepBuckets[bucket] = (stepBuckets[bucket] ?? 0) + 1;
  }

  const totalRuns = runs.length;

  return (
    <div className="space-y-6">
      {/* Agent KPIs */}
      {kpis.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Agent Effectiveness
          </h3>
          <KpiGrid kpis={kpis} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Model breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Model Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {modelRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {modelRows.map(([model, count]) => (
                  <div key={model} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium">{model}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${Math.round((count / totalRuns) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Step Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stepBuckets).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stepBuckets)
                  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                  .map(([bucket, count]) => (
                    <div key={bucket} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium capitalize">{bucket}</span>
                          <span className="text-xs text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full"
                            style={{ width: `${Math.round((count / totalRuns) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent runs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              No runs yet. Start a chat to see analytics here.
            </p>
          ) : (
            <div className="divide-y">
              {runs.slice(0, 50).map((run) => (
                <div key={run.id} className="px-6 py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug line-clamp-1 font-medium">
                      {run.query || "(no query)"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <ModelBadge model={run.model} />
                      <span className="text-[10px] text-muted-foreground">
                        {run.step_count} step{run.step_count !== 1 ? "s" : ""}
                      </span>
                      {run.duration_ms && (
                        <span className="text-[10px] text-muted-foreground">
                          {(run.duration_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      {run.error && (
                        <span className="text-[10px] text-destructive font-medium">error</span>
                      )}
                      {(run.tool_calls as { tool: string; count: number }[]).map((tc) => (
                        <span key={tc.tool} className="text-[10px] text-muted-foreground">
                          {tc.tool}&times;{tc.count}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {new Date(run.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
