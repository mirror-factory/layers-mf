import { createClient } from "@/lib/supabase/server";
import { BarChart3, Zap, Search, FileText, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runs } = await (supabase as any)
    .from("agent_runs")
    .select("id, created_at, model, query, step_count, finish_reason, total_input_tokens, total_output_tokens, duration_ms, tool_calls, error")
    .eq("org_id", memberRow.org_id)
    .order("created_at", { ascending: false })
    .limit(200) as { data: AgentRun[] | null };

  const allRuns = runs ?? [];

  // Compute summary stats
  const totalRuns = allRuns.length;
  const avgSteps =
    totalRuns === 0 ? 0 : (allRuns.reduce((s, r) => s + r.step_count, 0) / totalRuns).toFixed(1);
  const avgDurationMs =
    totalRuns === 0
      ? 0
      : Math.round(
          allRuns.filter((r) => r.duration_ms).reduce((s, r) => s + (r.duration_ms ?? 0), 0) /
            Math.max(1, allRuns.filter((r) => r.duration_ms).length)
        );
  const totalTokens = allRuns.reduce(
    (s, r) => s + (r.total_input_tokens ?? 0) + (r.total_output_tokens ?? 0),
    0
  );

  // Search hit rate: runs where search_context was called at least once
  const searchHits = allRuns.filter((r) =>
    (r.tool_calls as { tool: string }[]).some((tc) => tc.tool === "search_context")
  ).length;

  // Model breakdown
  const byModel: Record<string, number> = {};
  for (const r of allRuns) {
    const short = r.model.split("/")[1] ?? r.model;
    byModel[short] = (byModel[short] ?? 0) + 1;
  }
  const modelRows = Object.entries(byModel).sort((a, b) => b[1] - a[1]);

  // Step distribution
  const stepBuckets: Record<string, number> = {};
  for (const r of allRuns) {
    const bucket = `${r.step_count} step${r.step_count !== 1 ? "s" : ""}`;
    stepBuckets[bucket] = (stepBuckets[bucket] ?? 0) + 1;
  }

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Agent quality metrics across all chat runs for your organization.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Runs" value={totalRuns} icon={BarChart3} />
        <StatCard
          title="Avg Steps / Run"
          value={avgSteps}
          sub="max 6 steps"
          icon={Zap}
        />
        <StatCard
          title="Search Hit Rate"
          value={totalRuns === 0 ? "—" : `${Math.round((searchHits / totalRuns) * 100)}%`}
          sub={`${searchHits} of ${totalRuns} runs searched`}
          icon={Search}
        />
        <StatCard
          title="Avg Duration"
          value={totalRuns === 0 ? "—" : `${(avgDurationMs / 1000).toFixed(1)}s`}
          sub={`${totalTokens.toLocaleString()} total tokens`}
          icon={Clock}
        />
      </div>

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
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Recent Runs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              No runs yet. Start a chat to see analytics here.
            </p>
          ) : (
            <div className="divide-y">
              {allRuns.slice(0, 50).map((run) => (
                <div key={run.id} className="px-6 py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug line-clamp-1 font-medium">{run.query || "(no query)"}</p>
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
                          {tc.tool}×{tc.count}
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
