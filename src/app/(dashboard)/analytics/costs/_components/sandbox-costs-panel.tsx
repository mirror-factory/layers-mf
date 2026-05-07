"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Server, Clock, Users, ArrowDownToLine } from "lucide-react";
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

interface SandboxSummary {
  totalCost: number;
  totalCpuMs: number;
  totalMemoryMbSec: number;
  totalEgressBytes: number;
  totalExecutions: number;
  startDate: string;
  endDate: string;
}

interface SandboxBreakdownRow {
  key: string;
  executions: number;
  cpuMs: number;
  memoryMbSeconds: number;
  egressBytes: number;
  cost: number;
}

interface SandboxCostsResponse {
  summary: SandboxSummary;
  breakdown: SandboxBreakdownRow[];
  groupBy: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
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
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

// ─── Cost Bar ───────────────────────────────────────────────────────

function CostBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 sm:w-40 truncate text-xs text-muted-foreground" title={label}>
        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{label}</code>
      </div>
      <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
        <div
          className="h-full bg-orange-500/70 rounded-sm transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium w-16 text-right">{formatCost(value)}</span>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────

export function SandboxCostsPanel() {
  const [data, setData] = useState<SandboxCostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");
  const [groupBy, setGroupBy] = useState("day");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(period);
      const params = new URLSearchParams({ startDate, endDate, groupBy });
      const res = await fetch(`/api/analytics/sandbox-costs?${params}`);

      if (res.status === 403) {
        setError("You need admin access to view sandbox cost analytics.");
        return;
      }
      if (!res.ok) {
        setError("Failed to load sandbox cost data.");
        return;
      }

      setData(await res.json());
    } catch {
      setError("Failed to load sandbox cost data.");
    } finally {
      setLoading(false);
    }
  }, [period, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    );
  }

  if (!data) return null;

  const { summary, breakdown } = data;
  const maxCost = Math.max(...breakdown.map((r) => r.cost), 0);

  const summaryCards = [
    {
      label: "Sandbox Spend",
      value: formatCost(summary.totalCost),
      icon: Server,
      color: "text-orange-500",
    },
    {
      label: "CPU Time",
      value: formatDuration(summary.totalCpuMs),
      icon: Clock,
      color: "text-blue-500",
    },
    {
      label: "Executions",
      value: summary.totalExecutions.toLocaleString(),
      icon: Users,
      color: "text-purple-500",
    },
    {
      label: "Egress",
      value: formatBytes(summary.totalEgressBytes),
      icon: ArrowDownToLine,
      color: "text-green-500",
    },
  ];

  return (
    <div className="space-y-4">
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
            <SelectItem value="day">By Day</SelectItem>
            <SelectItem value="user">By User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </Card>
        ))}
      </div>

      {/* Cost Bars */}
      {breakdown.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">
              Spend by {groupBy === "user" ? "User" : "Day"}
            </h3>
          </div>
          <div className="space-y-2">
            {breakdown.slice(0, 15).map((row) => (
              <CostBar key={row.key} label={row.key} value={row.cost} max={maxCost} />
            ))}
          </div>
        </Card>
      )}

      {/* Breakdown Table */}
      {breakdown.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">Detailed Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">
                    {groupBy === "user" ? "User" : "Date"}
                  </th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Runs</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">CPU</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Egress</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="py-2">
                      {groupBy === "user" ? (
                        <Badge variant="secondary" className="font-normal text-xs">
                          {row.key.slice(0, 8)}...
                        </Badge>
                      ) : (
                        <span className="text-xs">{row.key}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{row.executions}</td>
                    <td className="py-2 text-right">{formatDuration(row.cpuMs)}</td>
                    <td className="py-2 text-right">{formatBytes(row.egressBytes)}</td>
                    <td className="py-2 text-right font-medium">{formatCost(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {breakdown.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">No sandbox usage for this period.</p>
        </Card>
      )}
    </div>
  );
}
