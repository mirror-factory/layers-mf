"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Loader2, Zap, Cpu, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PeriodSummary {
  total_tokens: number;
  total_cost: number;
  total_credits: number;
  operations: number;
}

interface OperationBreakdown {
  operation: string;
  count: number;
  tokens: number;
  credits: number;
}

interface ModelBreakdown {
  model: string;
  count: number;
  tokens: number;
}

interface UsageData {
  today: PeriodSummary;
  thisWeek: PeriodSummary;
  thisMonth: PeriodSummary;
  byOperation: OperationBreakdown[];
  byModel: ModelBreakdown[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatOperationName(op: string): string {
  return op
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SummaryCards({ summary }: { summary: PeriodSummary }) {
  const cards = [
    {
      label: "Operations",
      value: formatNumber(summary.operations),
      icon: Activity,
    },
    {
      label: "Tokens",
      value: formatNumber(summary.total_tokens),
      icon: Zap,
    },
    {
      label: "Credits Used",
      value: formatNumber(summary.total_credits),
      icon: Cpu,
    },
    {
      label: "Est. Cost",
      value: formatCost(summary.total_cost),
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <card.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-2xl font-bold">{card.value}</p>
        </Card>
      ))}
    </div>
  );
}

function OperationTable({ data }: { data: OperationBreakdown[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No operations recorded this month.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium text-muted-foreground">Operation</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Count</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Tokens</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Credits</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.operation} className="border-b last:border-0">
              <td className="py-2">
                <Badge variant="secondary" className="font-normal">
                  {formatOperationName(row.operation)}
                </Badge>
              </td>
              <td className="py-2 text-right">{row.count.toLocaleString()}</td>
              <td className="py-2 text-right">{formatNumber(row.tokens)}</td>
              <td className="py-2 text-right">{formatNumber(row.credits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelTable({ data }: { data: ModelBreakdown[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No model usage recorded this month.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium text-muted-foreground">Model</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Count</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.model} className="border-b last:border-0">
              <td className="py-2">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {row.model}
                </code>
              </td>
              <td className="py-2 text-right">{row.count.toLocaleString()}</td>
              <td className="py-2 text-right">{formatNumber(row.tokens)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsageHistory() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/usage");
      if (!res.ok) {
        setError("Failed to load usage data");
        return;
      }
      setUsage(await res.json());
    } catch {
      setError("Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !usage) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {error ?? "No usage data available."}
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid="usage-history">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Usage History</h3>
      </div>

      {/* Period toggle with summary cards */}
      <Tabs defaultValue="thisMonth">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="thisWeek">This Week</TabsTrigger>
          <TabsTrigger value="thisMonth">This Month</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <SummaryCards summary={usage.today} />
        </TabsContent>
        <TabsContent value="thisWeek">
          <SummaryCards summary={usage.thisWeek} />
        </TabsContent>
        <TabsContent value="thisMonth">
          <SummaryCards summary={usage.thisMonth} />
        </TabsContent>
      </Tabs>

      {/* By Operation breakdown */}
      <Card className="p-5">
        <h4 className="text-sm font-medium mb-3">By Operation</h4>
        <OperationTable data={usage.byOperation} />
      </Card>

      {/* By Model breakdown */}
      <Card className="p-5">
        <h4 className="text-sm font-medium mb-3">By Model</h4>
        <ModelTable data={usage.byModel} />
      </Card>
    </div>
  );
}
