"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, XCircle, Activity, Clock } from "lucide-react";

interface ProviderStats {
  provider: string;
  total: number;
  completed: number;
  failed: number;
  successRate: number;
  lastReceived: string | null;
  avgPerDay: number;
}

interface Alert {
  provider: string;
  message: string;
  severity: "warning" | "error";
}

interface WebhookHealthData {
  providers: ProviderStats[];
  totals: { total: number; completed: number; failed: number; successRate: number };
  last24h: { total: number; completed: number; failed: number };
  alerts: Alert[];
}

function rateColor(rate: number): string {
  if (rate >= 0.95) return "text-green-600 dark:text-green-400";
  if (rate >= 0.85) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function rateBg(rate: number): string {
  if (rate >= 0.95) return "bg-green-100 dark:bg-green-900/30";
  if (rate >= 0.85) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function WebhookHealth() {
  const [data, setData] = useState<WebhookHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/webhook-health");
        if (!res.ok) {
          setError("Failed to load webhook health data");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load webhook health data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Loading webhook stats...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            {error ?? "No data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { providers, totals, last24h, alerts } = data;

  return (
    <div className="space-y-4">
      {/* Overall totals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Webhook Health
          </CardTitle>
          <CardDescription>Delivery stats across all webhook providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="text-2xl font-semibold">{totals.total}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className={`text-2xl font-semibold ${rateColor(totals.successRate)}`}>
                {(totals.successRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last 24h</p>
              <p className="text-2xl font-semibold">{last24h.total}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Failed (24h)</p>
              <p className={`text-2xl font-semibold ${last24h.failed > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {last24h.failed}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4 space-y-2">
            {alerts.map((alert) => (
              <div
                key={`${alert.provider}-${alert.severity}`}
                className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                  alert.severity === "error"
                    ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                    : "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                }`}
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium capitalize">{alert.provider}</span>
                <span>{alert.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-provider cards */}
      {providers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No webhook events recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <Card key={p.provider}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize text-sm">{p.provider}</span>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${rateBg(p.successRate)} ${rateColor(p.successRate)}`}
                  >
                    {(p.successRate * 100).toFixed(0)}%
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{p.total}</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      OK
                    </div>
                    <p className="font-medium">{p.completed}</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <XCircle className="h-3 w-3 text-red-500" />
                      Failed
                    </div>
                    <p className="font-medium">{p.failed}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelative(p.lastReceived)}
                  </div>
                  <span>{p.avgPerDay}/day avg</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
