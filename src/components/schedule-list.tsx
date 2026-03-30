"use client";

import { useState } from "react";
import {
  Clock,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Calendar,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cronToHuman } from "@/lib/cron";

type ScheduledAction = {
  id: string;
  name: string;
  description: string | null;
  action_type: string;
  target_service: string | null;
  schedule: string;
  next_run_at: string | null;
  last_run_at: string | null;
  status: string;
  run_count: number;
  max_runs: number | null;
  created_at: string;
};

type Tab = "active" | "paused" | "completed";

const TABS: { value: Tab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 60_000) return diffMs > 0 ? "in < 1 min" : "< 1 min ago";
  if (absDiffMs < 3_600_000) {
    const mins = Math.round(absDiffMs / 60_000);
    return diffMs > 0 ? `in ${mins}m` : `${mins}m ago`;
  }
  if (absDiffMs < 86_400_000) {
    const hrs = Math.round(absDiffMs / 3_600_000);
    return diffMs > 0 ? `in ${hrs}h` : `${hrs}h ago`;
  }
  const days = Math.round(absDiffMs / 86_400_000);
  return diffMs > 0 ? `in ${days}d` : `${days}d ago`;
}

const SERVICE_COLORS: Record<string, string> = {
  linear: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  gmail: "bg-red-500/10 text-red-600 dark:text-red-400",
  granola: "bg-green-500/10 text-green-600 dark:text-green-400",
  slack: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  notion: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
};

export function ScheduleList({
  initialSchedules,
}: {
  initialSchedules: ScheduledAction[];
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [tab, setTab] = useState<Tab>("active");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = schedules.filter((s) => {
    if (tab === "completed") return s.status === "completed" || s.status === "failed";
    return s.status === tab;
  });

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    setLoadingId(id);
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
        );
      }
    } finally {
      setLoadingId(null);
    }
  };

  const deleteSchedule = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setLoadingId(null);
    }
  };

  const runNow = async (schedule: ScheduledAction) => {
    setLoadingId(schedule.id);
    try {
      // Map known target services to their cron endpoints
      const endpointMap: Record<string, string> = {
        linear: "/api/cron/linear-check",
        digest: "/api/cron/digest",
        discord: "/api/cron/discord-alerts",
        ingest: "/api/cron/ingest",
      };

      const endpoint =
        endpointMap[schedule.target_service ?? ""] ??
        endpointMap[schedule.action_type] ??
        null;

      if (!endpoint) {
        alert(`No endpoint mapped for service: ${schedule.target_service ?? schedule.action_type}`);
        return;
      }

      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        // Update last_run_at locally
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === schedule.id
              ? { ...s, last_run_at: new Date().toISOString(), run_count: s.run_count + 1 }
              : s
          )
        );
        alert(`Completed: ${JSON.stringify(data.summary ?? data, null, 2)}`);
      } else {
        alert(`Error: ${data.error ?? "Unknown error"}`);
      }
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {TABS.map((t) => {
          const count = schedules.filter((s) => {
            if (t.value === "completed") return s.status === "completed" || s.status === "failed";
            return s.status === t.value;
          }).length;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {tab} schedules</p>
          <p className="text-xs mt-1">
            Ask Granger to schedule tasks like &ldquo;check my Linear every morning&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((schedule) => (
            <div
              key={schedule.id}
              className={cn(
                "border rounded-lg p-4 transition-colors",
                loadingId === schedule.id && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium truncate">{schedule.name}</h3>
                    {schedule.target_service && (
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                          SERVICE_COLORS[schedule.target_service] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {schedule.target_service}
                      </span>
                    )}
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
                      {schedule.action_type}
                    </span>
                  </div>

                  {schedule.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {schedule.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      {cronToHuman(schedule.schedule)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Next: {formatRelativeDate(schedule.next_run_at)}
                    </span>
                    {schedule.last_run_at && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Last: {formatRelativeDate(schedule.last_run_at)}
                      </span>
                    )}
                    <span>
                      Runs: {schedule.run_count}
                      {schedule.max_runs != null && `/${schedule.max_runs}`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {schedule.status === "active" && (
                    <button
                      onClick={() => runNow(schedule)}
                      disabled={loadingId === schedule.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                      title="Run Now"
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                  )}
                  {(schedule.status === "active" || schedule.status === "paused") && (
                    <button
                      onClick={() => toggleStatus(schedule.id, schedule.status)}
                      disabled={loadingId === schedule.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      title={schedule.status === "active" ? "Pause" : "Resume"}
                    >
                      {schedule.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => deleteSchedule(schedule.id)}
                    disabled={loadingId === schedule.id}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
