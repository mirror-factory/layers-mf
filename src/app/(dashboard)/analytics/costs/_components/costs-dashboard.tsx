"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  Zap,
  Cpu,
  Activity,
  Loader2,
  Coins,
  TrendingUp,
  Clock,
  MessageSquare,
  Server,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ──────────────────────────────────────────────────────────

interface CostsSummary { totalCost: number; totalTokens: number; totalCredits: number; totalOperations: number; creditBalance: number | null; startDate: string; endDate: string }
interface BreakdownRow { key: string; operations: number; tokens: number; cost: number; credits: number }
interface CostsResponse { summary: CostsSummary; breakdown: BreakdownRow[]; groupBy: string }
interface UsageSummary { totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalCost: number; totalCacheReadTokens: number; cacheHitRate: number; avgDurationMs: number; avgTtft: number; modelsUsed: number; uniqueConversations: number }
interface UsageModelRow { model: string; requests: number; inputTokens: number; outputTokens: number; cost: number; avgDuration: number }
interface UsageProviderRow { provider: string; requests: number; cost: number }
interface UsageToolRow { tool: string; count: number }
interface UsageResponse { summary: UsageSummary; byModel: UsageModelRow[]; byProvider: UsageProviderRow[]; topTools: UsageToolRow[] }

// ─── Helpers ────────────────────────────────────────────────────────
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  start.setDate(start.getDate() - days);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function periodToUsagePeriod(p: string): string {
  return p === "7d" ? "week" : "month";
}

const PROVIDER_COLORS: Record<string, string> = { anthropic: "bg-primary", openai: "bg-blue-500", google: "bg-amber-500", ollama: "bg-zinc-600" };
function providerColor(p: string): string { return PROVIDER_COLORS[p.toLowerCase()] ?? "bg-zinc-500"; }

// ─── Bar Chart (pure CSS) ───────────────────────────────────────────

function CostBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 sm:w-40 truncate text-xs text-muted-foreground" title={label}>
        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{label}</code>
      </div>
      <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
        <div
          className="h-full bg-primary/70 rounded-sm transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium w-16 text-right">{formatCost(value)}</span>
    </div>
  );
}

function CountBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 sm:w-40 truncate text-xs text-muted-foreground" title={label}>
        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{label}</code>
      </div>
      <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
        <div
          className="h-full bg-primary/60 rounded-sm transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium w-12 text-right font-mono tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ─── Summary Cards ──────────────────────────────────────────────────

function SummaryCards({
  costs,
  usage,
}: {
  costs: CostsSummary;
  usage: UsageSummary | null;
}) {
  const cards = [
    {
      label: "Total Spend",
      value: formatCost(costs.totalCost),
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "Total Tokens",
      value: formatNumber(costs.totalTokens),
      icon: Zap,
      color: "text-blue-500",
    },
    {
      label: "Credits Used",
      value: formatNumber(costs.totalCredits),
      icon: Cpu,
      color: "text-purple-500",
    },
    {
      label: "Operations",
      value: formatNumber(costs.totalOperations),
      icon: Activity,
      color: "text-orange-500",
    },
    {
      label: "Cache Hit Rate",
      value: usage ? `${usage.cacheHitRate}%` : "--",
      icon: TrendingUp,
      color: "text-emerald-500",
    },
    {
      label: "Avg TTFT",
      value: usage ? `${usage.avgTtft}ms` : "--",
      icon: Clock,
      color: "text-cyan-500",
    },
    {
      label: "Models Used",
      value: usage ? usage.modelsUsed.toString() : "--",
      icon: Server,
      color: "text-yellow-500",
    },
    {
      label: "Conversations",
      value: usage ? formatNumber(usage.uniqueConversations) : "--",
      icon: MessageSquare,
      color: "text-pink-500",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <card.icon className={`h-4 w-4 ${card.color}`} />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-2xl font-bold">{card.value}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── Provider Breakdown ─────────────────────────────────────────────

function ProviderBreakdown({ providers }: { providers: UsageProviderRow[] }) {
  if (providers.length === 0) return null;
  const maxCost = Math.max(...providers.map((p) => p.cost), 0.01);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Server className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Cost by Provider</h3>
      </div>
      <div className="space-y-3">
        {providers.map((row) => {
          const pct = maxCost > 0 ? Math.max((row.cost / maxCost) * 100, 1) : 0;
          return (
            <div key={row.provider} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/80 capitalize">{row.provider}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">
                    {row.requests.toLocaleString()} requests
                  </span>
                  <span className="text-xs font-mono tabular-nums font-medium">
                    {formatCost(row.cost)}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${providerColor(row.provider)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Cache Performance ──────────────────────────────────────────────

function CachePerformance({ usage }: { usage: UsageSummary }) {
  const totalInput = usage.totalInputTokens + usage.totalCacheReadTokens;
  const cacheRatio = totalInput > 0
    ? Math.round((usage.totalCacheReadTokens / totalInput) * 100)
    : 0;

  // Estimate savings: cache reads cost ~90% less than fresh input tokens
  // Use a rough average input price of $3/1M tokens
  const avgInputPrice = 3 / 1_000_000;
  const savings = usage.totalCacheReadTokens * 0.9 * avgInputPrice;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Cache Performance</h3>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Cache reads vs total input tokens
            </span>
            <span className="font-mono tabular-nums font-medium">{cacheRatio}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-emerald-500/80 transition-all duration-500"
              style={{ width: `${cacheRatio}%` }}
            />
            <div
              className="h-full bg-zinc-600 transition-all duration-500"
              style={{ width: `${100 - cacheRatio}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Cache: {formatNumber(usage.totalCacheReadTokens)} tokens</span>
            <span>Fresh: {formatNumber(usage.totalInputTokens)} tokens</span>
          </div>
        </div>

        {savings > 0 && (
          <p className="text-xs text-emerald-400">
            You saved approximately {formatCost(savings)} from prompt caching
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Top Tools ──────────────────────────────────────────────────────

function TopToolsSection({ tools }: { tools: UsageToolRow[] }) {
  if (tools.length === 0) return null;
  const maxCount = Math.max(...tools.map((t) => t.count), 1);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Top Tools</h3>
      </div>
      <div className="space-y-2">
        {tools.map((row) => (
          <CountBar
            key={row.tool}
            label={row.tool}
            value={row.count}
            max={maxCount}
          />
        ))}
      </div>
    </Card>
  );
}

// ─── Per-Model Detail Table ─────────────────────────────────────────

function ModelDetailTable({ models }: { models: UsageModelRow[] }) {
  if (models.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No model data for this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium text-muted-foreground">Model</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Requests</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Input</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Output</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Cost</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Avg Duration</th>
          </tr>
        </thead>
        <tbody>
          {models.map((row) => (
            <tr key={row.model} className="border-b last:border-0">
              <td className="py-2">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {row.model}
                </code>
              </td>
              <td className="py-2 text-right">{row.requests.toLocaleString()}</td>
              <td className="py-2 text-right">{formatNumber(row.inputTokens)}</td>
              <td className="py-2 text-right">{formatNumber(row.outputTokens)}</td>
              <td className="py-2 text-right font-medium">{formatCost(row.cost)}</td>
              <td className="py-2 text-right">
                {row.avgDuration > 0 ? `${row.avgDuration}ms` : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Breakdown Table (costs API) ────────────────────────────────────

function BreakdownTable({
  rows,
  groupBy,
}: {
  rows: BreakdownRow[];
  groupBy: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No data for this period.
      </p>
    );
  }

  const groupLabel =
    groupBy === "user"
      ? "User"
      : groupBy === "date"
        ? "Date"
        : groupBy === "provider"
          ? "Provider"
          : "Model";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium text-muted-foreground">
              {groupLabel}
            </th>
            <th className="pb-2 font-medium text-muted-foreground text-right">
              Ops
            </th>
            <th className="pb-2 font-medium text-muted-foreground text-right">
              Tokens
            </th>
            <th className="pb-2 font-medium text-muted-foreground text-right">
              Credits
            </th>
            <th className="pb-2 font-medium text-muted-foreground text-right">
              Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b last:border-0">
              <td className="py-2">
                {groupBy === "model" || groupBy === "provider" ? (
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {row.key}
                  </code>
                ) : groupBy === "date" ? (
                  <span className="text-xs">{row.key}</span>
                ) : (
                  <Badge variant="secondary" className="font-normal text-xs">
                    {row.key.slice(0, 8)}...
                  </Badge>
                )}
              </td>
              <td className="py-2 text-right">{row.operations.toLocaleString()}</td>
              <td className="py-2 text-right">{formatNumber(row.tokens)}</td>
              <td className="py-2 text-right">{formatNumber(row.credits)}</td>
              <td className="py-2 text-right font-medium">
                {formatCost(row.cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────

export function CostsDashboard() {
  const [costsData, setCostsData] = useState<CostsResponse | null>(null);
  const [usageData, setUsageData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");
  const [groupBy, setGroupBy] = useState("model");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(period);
      const costsParams = new URLSearchParams({ startDate, endDate, groupBy });
      const usagePeriod = periodToUsagePeriod(period);

      const [costsRes, usageRes] = await Promise.all([
        fetch(`/api/analytics/costs?${costsParams}`),
        fetch(`/api/analytics/usage?period=${usagePeriod}`),
      ]);

      if (costsRes.status === 403) {
        setError("You need admin access to view cost analytics.");
        return;
      }
      if (!costsRes.ok) {
        setError("Failed to load cost data.");
        return;
      }

      const costs = await costsRes.json();
      setCostsData(costs);

      if (usageRes.ok) {
        const usage = await usageRes.json();
        setUsageData(usage);
      }
    } catch {
      setError("Failed to load cost data.");
    } finally {
      setLoading(false);
    }
  }, [period, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    const isAccessError = error.includes("admin access");
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center text-center py-8">
          <Coins className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium mb-1">
            {isAccessError ? "Access Restricted" : "No AI cost data yet"}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {isAccessError
              ? error
              : "Costs will appear here as you use Granger. Start a conversation to see token usage, credits, and spend broken down by model."}
          </p>
        </div>
      </Card>
    );
  }

  if (!costsData) return null;

  const maxCost = Math.max(...costsData.breakdown.map((r) => r.cost), 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="model">By Model</SelectItem>
            <SelectItem value="provider">By Provider</SelectItem>
            <SelectItem value="user">By User</SelectItem>
            <SelectItem value="date">By Day</SelectItem>
          </SelectContent>
        </Select>

        {costsData.summary.creditBalance !== null && (
          <div className="ml-auto flex items-center gap-2 rounded-md border px-3 py-1.5">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {costsData.summary.creditBalance.toLocaleString()} credits remaining
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <SummaryCards
        costs={costsData.summary}
        usage={usageData?.summary ?? null}
      />

      {/* Cost Bars (only for model grouping) */}
      {groupBy === "model" && costsData.breakdown.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Spend by Model</h3>
          </div>
          <div className="space-y-2">
            {costsData.breakdown.slice(0, 10).map((row) => (
              <CostBar
                key={row.key}
                label={row.key}
                value={row.cost}
                max={maxCost}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Provider Breakdown */}
      {usageData && usageData.byProvider.length > 0 && (
        <ProviderBreakdown providers={usageData.byProvider} />
      )}

      {/* Cache Performance + Top Tools side by side */}
      {usageData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <CachePerformance usage={usageData.summary} />
          <TopToolsSection tools={usageData.topTools} />
        </div>
      )}

      {/* Per-Model Detail Table (from usage API) */}
      {usageData && groupBy === "model" && usageData.byModel.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">
            Per-Model Detail
          </h3>
          <ModelDetailTable models={usageData.byModel} />
        </Card>
      )}

      {/* Breakdown Table (from costs API) */}
      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">
          Detailed Breakdown
        </h3>
        <BreakdownTable rows={costsData.breakdown} groupBy={groupBy} />
      </Card>
    </div>
  );
}
