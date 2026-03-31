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

interface CostsSummary {
  totalCost: number;
  totalTokens: number;
  totalCredits: number;
  totalOperations: number;
  creditBalance: number | null;
  startDate: string;
  endDate: string;
}

interface BreakdownRow {
  key: string;
  operations: number;
  tokens: number;
  cost: number;
  credits: number;
}

interface CostsResponse {
  summary: CostsSummary;
  breakdown: BreakdownRow[];
  groupBy: string;
}

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

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

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

// ─── Summary Cards ──────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: CostsSummary }) {
  const cards = [
    {
      label: "Total Spend",
      value: formatCost(summary.totalCost),
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "Total Tokens",
      value: formatNumber(summary.totalTokens),
      icon: Zap,
      color: "text-blue-500",
    },
    {
      label: "Credits Used",
      value: formatNumber(summary.totalCredits),
      icon: Cpu,
      color: "text-purple-500",
    },
    {
      label: "Operations",
      value: formatNumber(summary.totalOperations),
      icon: Activity,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

// ─── Breakdown Table ────────────────────────────────────────────────

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
    groupBy === "user" ? "User" : groupBy === "date" ? "Date" : "Model";

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
                {groupBy === "model" ? (
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
  const [data, setData] = useState<CostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");
  const [groupBy, setGroupBy] = useState("model");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(period);
      const params = new URLSearchParams({ startDate, endDate, groupBy });
      const res = await fetch(`/api/analytics/costs?${params}`);

      if (res.status === 403) {
        setError("You need admin access to view cost analytics.");
        return;
      }
      if (!res.ok) {
        setError("Failed to load cost data.");
        return;
      }

      setData(await res.json());
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

  if (!data) return null;

  const maxCost = Math.max(...data.breakdown.map((r) => r.cost), 0);

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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="model">By Model</SelectItem>
            <SelectItem value="user">By User</SelectItem>
            <SelectItem value="date">By Date</SelectItem>
          </SelectContent>
        </Select>

        {data.summary.creditBalance !== null && (
          <div className="ml-auto flex items-center gap-2 rounded-md border px-3 py-1.5">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {data.summary.creditBalance.toLocaleString()} credits remaining
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={data.summary} />

      {/* Cost Bars (only for model grouping) */}
      {groupBy === "model" && data.breakdown.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Spend by Model</h3>
          </div>
          <div className="space-y-2">
            {data.breakdown.slice(0, 10).map((row) => (
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

      {/* Breakdown Table */}
      <Card className="p-5">
        <h3 className="text-sm font-medium mb-3">
          Detailed Breakdown
        </h3>
        <BreakdownTable rows={data.breakdown} groupBy={groupBy} />
      </Card>
    </div>
  );
}
