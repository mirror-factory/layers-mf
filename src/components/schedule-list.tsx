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
  Pencil,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cronToHuman, isValidCron } from "@/lib/cron";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  { label: "Every hour", value: "0 * * * *", description: "At minute 0 of every hour" },
  { label: "Daily at 9am", value: "0 9 * * *", description: "Every day at 9:00 AM" },
  { label: "Weekdays at 9am", value: "0 9 * * 1-5", description: "Monday through Friday at 9:00 AM" },
  { label: "Every 6 hours", value: "0 */6 * * *", description: "At minute 0 every 6 hours" },
  { label: "Weekly Monday 9am", value: "0 9 * * 1", description: "Every Monday at 9:00 AM" },
  { label: "Every 30 minutes", value: "*/30 * * * *", description: "At minute 0 and 30 of every hour" },
  { label: "Custom", value: "", description: "Enter a custom cron expression" },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  paused: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

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

function getPromptFromSchedule(schedule: ScheduledAction): string {
  const prompt =
    (schedule.payload as Record<string, unknown> | null)?.prompt as string | undefined;
  return prompt ?? schedule.description ?? "";
}

// ── Cron Selector ──

function CronSelector({
  selectedPreset,
  customCron,
  cronError,
  onPresetChange,
  onCustomCronChange,
}: {
  selectedPreset: string;
  customCron: string;
  cronError: string | null;
  onPresetChange: (value: string) => void;
  onCustomCronChange: (value: string) => void;
}) {
  const cronValue = selectedPreset || customCron;

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-2">
        Schedule
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {CRON_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              onPresetChange(preset.value);
              if (preset.value) onCustomCronChange("");
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
        <div>
          <input
            type="text"
            value={customCron}
            onChange={(e) => onCustomCronChange(e.target.value)}
            placeholder="Cron expression, e.g. 0 9 * * 1-5"
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
              cronError && "border-destructive focus:ring-destructive",
            )}
          />
          {cronError && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {cronError}
            </p>
          )}
        </div>
      )}
      {cronValue && !cronError && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {cronToHuman(cronValue)}
        </p>
      )}
    </div>
  );
}

// ── Schedule Form (used in Sheet for create + edit) ──

function ScheduleForm({
  mode,
  initialName,
  initialPrompt,
  initialSchedule,
  onSubmit,
  onCancel,
  submitting,
}: {
  mode: "create" | "edit";
  initialName: string;
  initialPrompt: string;
  initialSchedule: string;
  onSubmit: (data: { name: string; prompt: string; schedule: string }) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const matchingPreset = CRON_PRESETS.find((p) => p.value === initialSchedule && p.value !== "");
  const [name, setName] = useState(initialName);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedPreset, setSelectedPreset] = useState(matchingPreset?.value ?? "");
  const [customCron, setCustomCron] = useState(matchingPreset ? "" : initialSchedule);
  const [cronError, setCronError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cronValue = selectedPreset || customCron;

  const validateCron = (value: string): boolean => {
    if (!value.trim()) {
      setCronError("Cron expression is required.");
      return false;
    }
    if (!isValidCron(value.trim())) {
      setCronError("Invalid cron expression. Use format: minute hour day month weekday");
      return false;
    }
    setCronError(null);
    return true;
  };

  const handleCustomCronChange = (value: string) => {
    setCustomCron(value);
    if (value.trim()) {
      validateCron(value);
    } else {
      setCronError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) {
      setError("Name and prompt are required.");
      return;
    }
    if (!cronValue.trim()) {
      setError("Schedule is required.");
      return;
    }
    if (!selectedPreset && !validateCron(cronValue)) {
      return;
    }
    setError(null);
    onSubmit({ name: name.trim(), prompt: prompt.trim(), schedule: cronValue.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 mt-4">
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
          rows={4}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <CronSelector
        selectedPreset={selectedPreset}
        customCron={customCron}
        cronError={cronError}
        onPresetChange={setSelectedPreset}
        onCustomCronChange={handleCustomCronChange}
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting
            ? mode === "create" ? "Creating..." : "Saving..."
            : mode === "create" ? "Create Schedule" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

// ── Schedule Row ──

function ScheduleRow({
  schedule,
  timezone,
  loading,
  onEdit,
  onToggleStatus,
  onDelete,
  onRunNow,
}: {
  schedule: ScheduledAction;
  timezone: string;
  loading: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onRunNow: () => void;
}) {
  const promptPreview = getPromptFromSchedule(schedule);

  return (
    <div
      className={cn(
        "group border-b last:border-b-0 px-4 py-3 transition-colors hover:bg-accent/30",
        loading && "opacity-60 pointer-events-none",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + status badge */}
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-medium truncate">{schedule.name}</h3>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-5 capitalize",
                STATUS_BADGE_STYLES[schedule.status] ?? "",
              )}
            >
              {schedule.status}
            </Badge>
          </div>

          {/* Row 2: Prompt preview */}
          {promptPreview && (
            <p className="text-xs text-muted-foreground mb-1.5 line-clamp-1 max-w-lg">
              {promptPreview}
            </p>
          )}

          {/* Row 3: Meta info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              {cronToHuman(schedule.schedule)}
            </span>
            <span
              className="flex items-center gap-1"
              title={schedule.next_run_at ? formatLocalDate(schedule.next_run_at, timezone) : undefined}
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
            <span className="flex items-center gap-1" title={timezone}>
              <Globe className="h-3 w-3" />
              {getTimezoneAbbr(timezone)}
            </span>
          </div>

          {/* Last conversation link */}
          {schedule.last_conversation_id && (
            <a
              href={`/chat?id=${schedule.last_conversation_id}`}
              className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View last run
            </a>
          )}
        </div>

        {/* Actions - visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {schedule.status === "active" && (
            <button
              onClick={onRunNow}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              title="Run Now"
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          )}
          {(schedule.status === "active" || schedule.status === "paused") && (
            <button
              onClick={onToggleStatus}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title={schedule.status === "active" ? "Pause" : "Resume"}
            >
              {schedule.status === "active" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
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

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [editingSchedule, setEditingSchedule] = useState<ScheduledAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ScheduledAction | null>(null);

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

  const openCreate = () => {
    setSheetMode("create");
    setEditingSchedule(null);
    setSheetOpen(true);
  };

  const openEdit = (schedule: ScheduledAction) => {
    setSheetMode("edit");
    setEditingSchedule(schedule);
    setSheetOpen(true);
  };

  const handleCreate = async (data: { name: string; prompt: string; schedule: string }) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          prompt: data.prompt,
          schedule: data.schedule,
        }),
      });
      if (res.ok) {
        setSheetOpen(false);
        fetchSchedules();
      }
    } catch {
      // handled by form
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: { name: string; prompt: string; schedule: string }) => {
    if (!editingSchedule) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          prompt: data.prompt,
          schedule: data.schedule,
        }),
      });
      if (res.ok) {
        setSheetOpen(false);
        fetchSchedules();
      }
    } catch {
      // handled by form
    } finally {
      setSubmitting(false);
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoadingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/schedules/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      }
    } finally {
      setLoadingId(null);
      setDeleteTarget(null);
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
        window.location.href = `/chat?id=${data.conversationId}`;
      }
      fetchSchedules();
    } catch {
      // silent
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div>
      {/* Header with tabs + create button */}
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
        <Button size="sm" className="ml-4" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {tab} schedules</p>
          <p className="text-xs mt-1">
            Create a schedule or ask Granger in chat.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {filtered.map((schedule) => (
            <ScheduleRow
              key={schedule.id}
              schedule={schedule}
              timezone={timezone}
              loading={loadingId === schedule.id}
              onEdit={() => openEdit(schedule)}
              onToggleStatus={() => toggleStatus(schedule.id, schedule.status)}
              onDelete={() => setDeleteTarget(schedule)}
              onRunNow={() => runNow(schedule)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === "create" ? "New Schedule" : "Edit Schedule"}
            </SheetTitle>
            <SheetDescription>
              {sheetMode === "create"
                ? "Set up a recurring AI task that runs automatically."
                : "Update the schedule name, prompt, or timing."}
            </SheetDescription>
          </SheetHeader>
          <ScheduleForm
            key={editingSchedule?.id ?? "create"}
            mode={sheetMode}
            initialName={editingSchedule?.name ?? ""}
            initialPrompt={editingSchedule ? getPromptFromSchedule(editingSchedule) : ""}
            initialSchedule={editingSchedule?.schedule ?? "0 9 * * *"}
            onSubmit={sheetMode === "create" ? handleCreate : handleEdit}
            onCancel={() => setSheetOpen(false)}
            submitting={submitting}
          />
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot; and stop all future runs.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
