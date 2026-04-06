"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Calendar,
  Zap,
  Globe,
  Plus,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cronToHuman } from "@/lib/cron";

type ScheduledAction = {
  id: string;
  name: string;
  description: string | null;
  action_type: string;
  target_service: string | null;
  payload: Record<string, unknown> | null;
  schedule: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_conversation_id: string | null;
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

const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
  { label: "Weekly Monday 9 AM", value: "0 9 * * 1" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Custom", value: "" },
];

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "--";
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

function formatLocalDate(dateStr: string | null, timezone: string): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date(dateStr).toLocaleString();
  }
}

function getTimezoneAbbr(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
}

// ── Create Schedule Form ──

function CreateScheduleForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(CRON_PRESETS[1].value);
  const [customCron, setCustomCron] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cronValue = selectedPreset || customCron;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim() || !cronValue.trim()) {
      setError("Name, prompt, and schedule are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          prompt: prompt.trim(),
          schedule: cronValue.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create schedule");
        return;
      }

      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">New Schedule</h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-md text-muted-foreground hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label htmlFor="sched-name" className="block text-xs font-medium text-muted-foreground mb-1">
          Name
        </label>
        <input
          id="sched-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning Linear check"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label htmlFor="sched-prompt" className="block text-xs font-medium text-muted-foreground mb-1">
          Prompt
        </label>
        <textarea
          id="sched-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should the AI do? e.g. Check my open Linear issues and summarize what needs attention today."
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Schedule
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {CRON_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setSelectedPreset(preset.value);
                if (preset.value) setCustomCron("");
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs border transition-colors",
                (preset.value ? selectedPreset === preset.value : !selectedPreset)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {!selectedPreset && (
          <input
            type="text"
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="Cron expression, e.g. 0 9 * * 1-5"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
        {cronValue && (
          <p className="mt-1 text-xs text-muted-foreground">
            {cronToHuman(cronValue)}
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-md border text-muted-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Schedule"}
        </button>
      </div>
    </form>
  );
}

// ── Main List ──

export function ScheduleList({
  initialSchedules,
}: {
  initialSchedules: ScheduledAction[];
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [tab, setTab] = useState<Tab>("active");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("America/New_York");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) setTimezone(tz);
  }, []);

  const filtered = schedules.filter((s) => {
    if (tab === "completed") return s.status === "completed" || s.status === "failed";
    return s.status === tab;
  });

  const fetchSchedules = async () => {
    try {
      const res = await fetch("/api/schedules");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules ?? []);
      }
    } catch {
      // silently fail
    }
  };

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
          prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)),
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
      const res = await fetch("/api/schedules/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: schedule.id }),
      });
      const data = await res.json();

      if (data.conversationId) {
        if (confirm("Schedule executed. Open the results conversation?")) {
          window.location.href = `/chat?id=${data.conversationId}`;
        }
      } else if (data.error) {
        alert(data.error);
      } else {
        alert("Executed successfully");
      }

      fetchSchedules();
    } catch {
      alert("Failed to execute");
    } finally {
      setLoadingId(null);
    }
  };

  const getPromptPreview = (schedule: ScheduledAction): string | null => {
    const prompt =
      (schedule.payload as Record<string, unknown> | null)?.prompt as string | undefined;
    return prompt ?? schedule.description;
  };

  return (
    <div>
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 border-b flex-1">
          {TABS.map((t) => {
            const count = schedules.filter((s) => {
              if (t.value === "completed")
                return s.status === "completed" || s.status === "failed";
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
                    : "border-transparent text-muted-foreground hover:text-foreground",
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
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateScheduleForm
          onCreated={() => {
            setShowCreate(false);
            fetchSchedules();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {tab} schedules</p>
          <p className="text-xs mt-1">
            Create a schedule above or ask Granger in chat.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((schedule) => {
            const promptPreview = getPromptPreview(schedule);
            return (
              <div
                key={schedule.id}
                className={cn(
                  "border rounded-lg p-4 transition-colors",
                  loadingId === schedule.id && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium truncate">
                        {schedule.name}
                      </h3>
                      {schedule.target_service && (
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                            SERVICE_COLORS[schedule.target_service] ??
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {schedule.target_service}
                        </span>
                      )}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
                        {schedule.action_type}
                      </span>
                    </div>

                    {promptPreview && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {promptPreview}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {cronToHuman(schedule.schedule)}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        title={
                          schedule.next_run_at
                            ? formatLocalDate(schedule.next_run_at, timezone)
                            : undefined
                        }
                      >
                        <Calendar className="h-3 w-3" />
                        Next: {formatRelativeDate(schedule.next_run_at)}
                      </span>
                      {schedule.last_run_at && (
                        <span
                          className="flex items-center gap-1"
                          title={formatLocalDate(schedule.last_run_at, timezone)}
                        >
                          <Zap className="h-3 w-3" />
                          Last: {formatRelativeDate(schedule.last_run_at)}
                        </span>
                      )}
                      <span>
                        Runs: {schedule.run_count}
                        {schedule.max_runs != null && `/${schedule.max_runs}`}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        title={timezone}
                      >
                        <Globe className="h-3 w-3" />
                        {getTimezoneAbbr(timezone)}
                      </span>
                    </div>

                    {/* Link to last conversation */}
                    {schedule.last_conversation_id && (
                      <a
                        href={`/chat?id=${schedule.last_conversation_id}`}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View last run
                      </a>
                    )}
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
                    {(schedule.status === "active" ||
                      schedule.status === "paused") && (
                      <button
                        onClick={() =>
                          toggleStatus(schedule.id, schedule.status)
                        }
                        disabled={loadingId === schedule.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        title={
                          schedule.status === "active" ? "Pause" : "Resume"
                        }
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
            );
          })}
        </div>
      )}
    </div>
  );
}
