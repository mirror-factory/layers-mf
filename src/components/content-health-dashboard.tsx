"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  Archive,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface FreshnessCounts {
  fresh: number;
  aging: number;
  stale: number;
  veryStale: number;
}

interface SourceBreakdown {
  source: string;
  total: number;
  fresh: number;
  stale: number;
  veryStale: number;
}

interface TypeBreakdown {
  type: string;
  total: number;
  fresh: number;
  stale: number;
  veryStale: number;
}

interface StaleItem {
  id: string;
  title: string;
  source_type: string;
  content_type: string;
  daysSinceUpdate: number;
}

interface ContentHealthResponse {
  total: number;
  byFreshness: FreshnessCounts;
  bySource: SourceBreakdown[];
  byContentType: TypeBreakdown[];
  staleItems: StaleItem[];
  healthScore: number;
}

function scoreColor(score: number): string {
  if (score > 75) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number): string {
  if (score > 75)
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (score >= 50)
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

function FreshnessBar({ counts, total }: { counts: FreshnessCounts; total: number }) {
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">No content items yet.</p>
    );
  }

  const segments = [
    { key: "fresh", count: counts.fresh, color: "bg-green-500", label: "Fresh" },
    { key: "aging", count: counts.aging, color: "bg-yellow-500", label: "Aging" },
    { key: "stale", count: counts.stale, color: "bg-orange-500", label: "Stale" },
    { key: "veryStale", count: counts.veryStale, color: "bg-red-500", label: "Very Stale" },
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((seg) => {
          const pct = (seg.count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={seg.key}
              className={`${seg.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${seg.count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
            <span className="text-muted-foreground">
              {seg.label}: <span className="font-medium text-foreground">{seg.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; total: number; fresh: number; stale: number; veryStale: number }[];
}) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-6 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Fresh</th>
                <th className="px-4 py-2 text-right font-medium">Stale</th>
                <th className="px-4 py-2 text-right font-medium">Very Stale</th>
                <th className="px-4 py-2 text-right font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const healthPct =
                  row.total > 0
                    ? ((row.total - row.stale - row.veryStale) / row.total) * 100
                    : 100;
                return (
                  <tr key={row.label}>
                    <td className="px-6 py-2.5 font-medium capitalize">
                      {row.label.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 text-right">{row.total}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400">
                      {row.fresh}
                    </td>
                    <td className="px-4 py-2.5 text-right text-orange-600 dark:text-orange-400">
                      {row.stale}
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400">
                      {row.veryStale}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress
                          value={healthPct}
                          className="h-1.5 w-16"
                        />
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {healthPct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentHealthDashboard() {
  const [data, setData] = useState<ContentHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/content-health");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json: ContentHealthResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading content health...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900/50">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Health Score + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Health Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-4">
            <span className={`text-5xl font-bold ${scoreColor(data.healthScore)}`}>
              {data.healthScore}
            </span>
            <Badge className={`mt-2 ${scoreBg(data.healthScore)}`}>
              {data.healthScore > 75
                ? "Healthy"
                : data.healthScore >= 50
                  ? "Needs Attention"
                  : "Critical"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {data.total} total items
            </p>
          </CardContent>
        </Card>

        {/* Freshness breakdown */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Freshness Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FreshnessBar counts={data.byFreshness} total={data.total} />
          </CardContent>
        </Card>
      </div>

      {/* By Source */}
      <BreakdownTable
        title="By Source"
        rows={data.bySource.map((s) => ({
          label: s.source,
          total: s.total,
          fresh: s.fresh,
          stale: s.stale,
          veryStale: s.veryStale,
        }))}
      />

      {/* By Content Type */}
      <BreakdownTable
        title="By Content Type"
        rows={data.byContentType.map((t) => ({
          label: t.type,
          total: t.total,
          fresh: t.fresh,
          stale: t.stale,
          veryStale: t.veryStale,
        }))}
      />

      {/* Stale Items List */}
      {data.staleItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Stale Items Needing Attention
              <Badge variant="secondary" className="ml-auto">
                {data.staleItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-6 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-left font-medium">Source</th>
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Days Stale
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.staleItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-2.5 font-medium max-w-[240px] truncate">
                        {item.title || "Untitled"}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">
                        {item.source_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">
                        {item.content_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge
                          variant="outline"
                          className={
                            item.daysSinceUpdate > 120
                              ? "border-red-300 text-red-600 dark:border-red-800 dark:text-red-400"
                              : "border-orange-300 text-orange-600 dark:border-orange-800 dark:text-orange-400"
                          }
                        >
                          {item.daysSinceUpdate}d
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/context/${item.id}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled title="Coming soon — no backend yet">
          <Archive className="h-4 w-4 mr-2" />
          Archive All Very Stale
        </Button>
        <Button variant="outline" asChild>
          <Link href="/integrations">
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-sync Stale Integrations
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={fetchData} className="ml-auto">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
