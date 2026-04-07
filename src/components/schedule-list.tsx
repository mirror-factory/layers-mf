"use client";

import { useState, useEffect, useMemo } from "react";
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cronToHuman, isValidCron } from "@/lib/cron";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

type Frequency = "once" | "daily" | "weekly" | "interval";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_CRON_VALUES = [1, 2, 3, 4, 5, 6, 0] as const;

const MINUTE_OPTIONS = ["00", "15", "30", "45"] as const;

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

// ── Schedule Picker (replaces CronSelector) ──

function parseCronToPickerState(cron: string): {
  frequency: Frequency;
  hour: number;
  minute: string;
  period: "AM" | "PM";
  selectedDays: number[];
  intervalValue: number;
  intervalUnit: "hours" | "minutes";
  onceDate: string;
} {
  const defaults = {
    hour: 9,
    minute: "00",
    period: "AM" as const,
    selectedDays: [] as number[],
    intervalValue: 6,
    intervalUnit: "hours" as const,
    onceDate: "",
  };

  if (cron.startsWith("once:")) {
    const dateStr = cron.replace("once:", "");
    const date = new Date(dateStr);
    const h = date.getHours();
    return {
      frequency: "once",
      hour: h === 0 ? 12 : h > 12 ? h - 12 : h,
      minute: String(date.getMinutes()).padStart(2, "0"),
      period: h >= 12 ? "PM" : "AM",
      selectedDays: [],
      intervalValue: 6,
      intervalUnit: "hours",
      onceDate: dateStr.split("T")[0] ?? "",
    };
  }

  const parts = cron.split(" ");
  if (parts.length !== 5) return { frequency: "daily", ...defaults };

  const [minutePart, hourPart, , , dowPart] = parts;

  // Interval patterns: */N or 0 */N
  if (minutePart?.startsWith("*/") && hourPart === "*") {
    const val = parseInt(minutePart.replace("*/", ""), 10);
    return {
      frequency: "interval",
      ...defaults,
      intervalValue: val,
      intervalUnit: "minutes",
    };
  }
  if (hourPart?.startsWith("*/") && minutePart === "0") {
    const val = parseInt(hourPart.replace("*/", ""), 10);
    return {
      frequency: "interval",
      ...defaults,
      intervalValue: val,
      intervalUnit: "hours",
    };
  }

  const h24 = parseInt(hourPart ?? "9", 10);
  const m = minutePart ?? "0";
  const displayHour = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const displayMinute = String(parseInt(m, 10)).padStart(2, "0");

  // Weekly with specific days
  if (dowPart && dowPart !== "*") {
    const days = dowPart.split(",").map((d) => parseInt(d, 10));
    return {
      frequency: "weekly",
      hour: displayHour,
      minute: displayMinute,
      period,
      selectedDays: days,
      intervalValue: 6,
      intervalUnit: "hours",
      onceDate: "",
    };
  }

  return {
    frequency: "daily",
    hour: displayHour,
    minute: displayMinute,
    period,
    selectedDays: [],
    intervalValue: 6,
    intervalUnit: "hours",
    onceDate: "",
  };
}

function buildCronFromPicker(state: {
  frequency: Frequency;
  hour: number;
  minute: string;
  period: "AM" | "PM";
  selectedDays: number[];
  intervalValue: number;
  intervalUnit: "hours" | "minutes";
  onceDate: string;
}): { cron: string; humanReadable: string } {
  const toH24 = (h: number, p: "AM" | "PM"): number => {
    if (p === "AM") return h === 12 ? 0 : h;
    return h === 12 ? 12 : h + 12;
  };
  const h24 = toH24(state.hour, state.period);
  const m = parseInt(state.minute, 10);

  const formatTime = () => `${state.hour}:${state.minute} ${state.period}`;

  switch (state.frequency) {
    case "once": {
      const dateStr = state.onceDate || new Date().toISOString().split("T")[0];
      const hh = String(h24).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return {
        cron: `once:${dateStr}T${hh}:${mm}:00`,
        humanReadable: `Once on ${dateStr} at ${formatTime()}`,
      };
    }
    case "daily":
      return {
        cron: `${m} ${h24} * * *`,
        humanReadable: `Daily at ${formatTime()}`,
      };
    case "weekly": {
      const dayNames: Record<number, string> = {
        0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed",
        4: "Thu", 5: "Fri", 6: "Sat",
      };
      const sorted = [...state.selectedDays].sort((a, b) => a - b);
      const dayStr = sorted.join(",") || "*";
      const dayLabels = sorted.map((d) => dayNames[d] ?? String(d)).join(", ");
      return {
        cron: `${m} ${h24} * * ${dayStr}`,
        humanReadable: sorted.length > 0
          ? `Every ${dayLabels} at ${formatTime()}`
          : `Weekly at ${formatTime()}`,
      };
    }
    case "interval": {
      if (state.intervalUnit === "minutes") {
        return {
          cron: `*/${state.intervalValue} * * * *`,
          humanReadable: `Every ${state.intervalValue} minutes`,
        };
      }
      return {
        cron: `0 */${state.intervalValue} * * *`,
        humanReadable: `Every ${state.intervalValue} hours`,
      };
    }
  }
}

interface SchedulePickerProps {
  value: string;
  onChange: (cron: string, humanReadable: string) => void;
}

function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const initial = useMemo(() => parseCronToPickerState(value), [value]);

  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(initial.period);
  const [selectedDays, setSelectedDays] = useState<number[]>(initial.selectedDays);
  const [intervalValue, setIntervalValue] = useState(initial.intervalValue);
  const [intervalUnit, setIntervalUnit] = useState<"hours" | "minutes">(initial.intervalUnit);
  const [onceDate, setOnceDate] = useState(initial.onceDate);

  const state = { frequency, hour, minute, period, selectedDays, intervalValue, intervalUnit, onceDate };
  const { cron, humanReadable } = buildCronFromPicker(state);

  useEffect(() => {
    onChange(cron, humanReadable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cron, humanReadable]);

  const toggleDay = (dayValue: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue],
    );
  };

  const frequencyOptions: { value: Frequency; label: string }[] = [
    { value: "once", label: "Once" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "interval", label: "Custom interval" },
  ];

  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium text-muted-foreground">
        Schedule
      </label>

      {/* Frequency selector */}
      <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
        {frequencyOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFrequency(opt.value)}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              frequency === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Date picker for "once" */}
      {frequency === "once" && (
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Date</label>
          <input
            type="date"
            value={onceDate}
            onChange={(e) => setOnceDate(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Time picker for once, daily, weekly */}
      {(frequency === "once" || frequency === "daily" || frequency === "weekly") && (
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Time</label>
          <div className="flex items-center gap-2">
            <select
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value, 10))}
              className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-muted-foreground">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "AM" | "PM")}
              className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      )}

      {/* Day picker for weekly */}
      {frequency === "weekly" && (
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Days</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, idx) => {
              const cronVal = DAY_CRON_VALUES[idx];
              const isActive = selectedDays.includes(cronVal);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(cronVal)}
                  className={cn(
                    "h-9 w-9 rounded-md text-xs font-medium transition-colors border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-accent",
                  )}
                >
                  {label.charAt(0)}
                </button>
              );
            })}
          </div>
          {selectedDays.length === 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Select at least one day
            </p>
          )}
        </div>
      )}

      {/* Interval picker */}
      {frequency === "interval" && (
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">
            Repeat every
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={intervalUnit === "hours" ? 23 : 59}
              value={intervalValue}
              onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={intervalUnit}
              onChange={(e) => setIntervalUnit(e.target.value as "hours" | "minutes")}
              className="rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="hours">hours</option>
              <option value="minutes">minutes</option>
            </select>
          </div>
        </div>
      )}

      {/* Human-readable preview */}
      <div className="rounded-md bg-muted/50 px-3 py-2">
        <p className="text-xs text-muted-foreground">{humanReadable}</p>
      </div>
    </div>
  );
}

// ── Schedule Form (used in Dialog for create, inline for edit) ──

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
  const [name, setName] = useState(initialName);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [cronValue, setCronValue] = useState(initialSchedule);
  const [, setHumanLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleScheduleChange = (cron: string, humanReadable: string) => {
    setCronValue(cron);
    setHumanLabel(humanReadable);
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
    // Validate non-once cron expressions
    if (!cronValue.startsWith("once:") && !isValidCron(cronValue)) {
      setError("Invalid schedule configuration.");
      return;
    }
    setError(null);
    onSubmit({ name: name.trim(), prompt: prompt.trim(), schedule: cronValue.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <SchedulePicker value={cronValue} onChange={handleScheduleChange} />

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
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
  isEditing,
  onEdit,
  onCancelEdit,
  onToggleStatus,
  onDelete,
  onRunNow,
  onSubmitEdit,
  editSubmitting,
}: {
  schedule: ScheduledAction;
  timezone: string;
  loading: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onRunNow: () => void;
  onSubmitEdit: (data: { name: string; prompt: string; schedule: string }) => void;
  editSubmitting: boolean;
}) {
  const promptPreview = getPromptFromSchedule(schedule);

  return (
    <div
      className={cn(
        "group border-b last:border-b-0 transition-colors",
        loading && "opacity-60 pointer-events-none",
      )}
    >
      <div className="px-4 py-3 hover:bg-accent/30">
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
              onClick={isEditing ? onCancelEdit : onEdit}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title={isEditing ? "Close edit" : "Edit"}
            >
              {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
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

      {/* Inline edit form */}
      {isEditing && (
        <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
          <ScheduleForm
            key={schedule.id}
            mode="edit"
            initialName={schedule.name}
            initialPrompt={getPromptFromSchedule(schedule)}
            initialSchedule={schedule.schedule}
            onSubmit={onSubmitEdit}
            onCancel={onCancelEdit}
            submitting={editSubmitting}
          />
        </div>
      )}
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

  // Dialog state for create
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

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
        setCreateDialogOpen(false);
        fetchSchedules();
      }
    } catch {
      // handled by form
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (scheduleId: string, data: { name: string; prompt: string; schedule: string }) => {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          prompt: data.prompt,
          schedule: data.schedule,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchSchedules();
      }
    } catch {
      // handled by form
    } finally {
      setEditSubmitting(false);
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
        <Button size="sm" className="ml-4" onClick={() => setCreateDialogOpen(true)}>
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
              isEditing={editingId === schedule.id}
              onEdit={() => setEditingId(schedule.id)}
              onCancelEdit={() => setEditingId(null)}
              onToggleStatus={() => toggleStatus(schedule.id, schedule.status)}
              onDelete={() => setDeleteTarget(schedule)}
              onRunNow={() => runNow(schedule)}
              onSubmitEdit={(data) => handleEdit(schedule.id, data)}
              editSubmitting={editSubmitting}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Schedule</DialogTitle>
            <DialogDescription>
              Set up a recurring AI task that runs automatically.
            </DialogDescription>
          </DialogHeader>
          <ScheduleForm
            key={createDialogOpen ? "open" : "closed"}
            mode="create"
            initialName=""
            initialPrompt=""
            initialSchedule="0 9 * * *"
            onSubmit={handleCreate}
            onCancel={() => setCreateDialogOpen(false)}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

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
