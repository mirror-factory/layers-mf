"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NeuralDots } from "@/components/ui/neural-dots";
import { Loader2, Users, FileText, Layers, MessageSquare } from "lucide-react";

interface OrgStats {
  memberCount: number;
  contextItemCount: number;
  artifactCount: number;
  conversationCount: number;
}

interface UsageData {
  creditBalance: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelBreakdown: Record<
    string,
    { runs: number; inputTokens: number; outputTokens: number }
  >;
}

interface ActivityItem {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface DashboardData {
  stats: OrgStats;
  usage: UsageData;
  activity: ActivityItem[];
  storage: Record<string, number>;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function OrgDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/org/stats");
    if (res.ok) {
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Unable to load dashboard data.
      </p>
    );
  }

  const { stats, usage, activity, storage } = data;
  const modelEntries = Object.entries(usage.modelBreakdown);
  const storageEntries = Object.entries(storage).sort((a, b) => b[1] - a[1]);
  const maxStorageCount = storageEntries.length > 0 ? storageEntries[0][1] : 1;

  return (
    <div className="space-y-6" data-testid="org-dashboard">
      {/* Header with NeuralDots */}
      <div className="flex items-center gap-3">
        <NeuralDots size={32} active={false} />
        <span className="text-sm text-muted-foreground">
          Organization overview
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-semibold">{stats.memberCount}</p>
              <p className="text-xs text-muted-foreground">Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-semibold">{formatNumber(stats.contextItemCount)}</p>
              <p className="text-xs text-muted-foreground">Content items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Layers className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-semibold">{formatNumber(stats.artifactCount)}</p>
              <p className="text-xs text-muted-foreground">Artifacts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-semibold">{formatNumber(stats.conversationCount)}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>AI credits and token consumption.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm text-muted-foreground">Credit balance</span>
            <span className="text-sm font-semibold">{formatNumber(usage.creditBalance)}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Total input tokens</p>
              <p className="text-lg font-semibold">{formatNumber(usage.totalInputTokens)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Total output tokens</p>
              <p className="text-lg font-semibold">{formatNumber(usage.totalOutputTokens)}</p>
            </div>
          </div>
          {modelEntries.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Models used</p>
              <div className="space-y-2">
                {modelEntries.map(([model, info]) => (
                  <div
                    key={model}
                    className="flex items-center justify-between text-sm rounded-md border px-3 py-2"
                  >
                    <span className="text-muted-foreground truncate mr-2">
                      {model}
                    </span>
                    <span className="shrink-0 font-mono text-xs">
                      {info.runs} runs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Breakdown */}
      {storageEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Storage</CardTitle>
            <CardDescription>Content items by source type.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {storageEntries.map(([sourceType, count]) => (
                <div key={sourceType} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{sourceType}</span>
                    <span className="font-mono text-xs">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(4, (count / maxStorageCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Last 10 actions in your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatAction(item.action)}
                    </p>
                    {item.resource_type && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.resource_type}
                        {item.resource_id ? ` / ${item.resource_id.slice(0, 8)}...` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(item.created_at)}
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
