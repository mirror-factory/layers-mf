"use client";

import { useState, useEffect, useRef } from "react";
import {
  Check,
  Loader2,
  RefreshCw,
  Trash2,
  AlertCircle,
  Github,
  MessageSquare,
  FileText,
  BarChart3,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface Integration {
  id: string;
  provider: string;
  nango_connection_id: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
}

export interface SyncProgress {
  phase: "fetching" | "processing" | "complete" | "error";
  message?: string;
  current?: number;
  total?: number;
  title?: string;
  processed?: number;
  fetched?: number;
}

interface IntegrationCardProps {
  integration: Integration;
  onSync: (integration: Integration) => Promise<void>;
  onSyncTrigger?: (integration: Integration) => Promise<boolean>;
  onDisconnect: (integration: Integration) => Promise<void>;
  syncing: boolean;
  syncResult?: string;
  syncDebug?: string[];
  syncProgress?: SyncProgress;
  backgroundSyncStatus?: "idle" | "triggered" | "polling" | "complete" | "timeout" | "error";
}

const PROVIDER_META: Record<
  string,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  github: {
    label: "GitHub",
    description: "Repositories and issues",
    icon: Github,
    color: "text-gray-900 dark:text-gray-100",
  },
  "github-app": {
    label: "GitHub",
    description: "Repositories and issues",
    icon: Github,
    color: "text-gray-900 dark:text-gray-100",
  },
  slack: {
    label: "Slack",
    description: "Messages and channels",
    icon: MessageSquare,
    color: "text-purple-600 dark:text-purple-400",
  },
  "google-drive": {
    label: "Google Drive",
    description: "Docs, Sheets, Slides, PDFs, and Word files",
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
  },
  linear: {
    label: "Linear",
    description: "Issues, projects, and cycles",
    icon: BarChart3,
    color: "text-indigo-600 dark:text-indigo-400",
  },
  granola: {
    label: "Granola",
    description: "Meeting transcripts and notes",
    icon: Mic,
    color: "text-amber-600 dark:text-amber-400",
  },
};

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Connected", variant: "default" },
  paused: { label: "Paused", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/** Elapsed time display that ticks every second while syncing */
function ElapsedTimer({ active }: { active: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (!active || elapsed === 0) return null;

  return (
    <span className="text-[11px] text-muted-foreground ml-2">
      {elapsed}s
    </span>
  );
}

/** Truncate a title to a max character length */
function truncateTitle(title: string, max = 40): string {
  if (title.length <= max) return title;
  return title.slice(0, max - 1) + "\u2026";
}

export function IntegrationCard({
  integration,
  onSync,
  onSyncTrigger,
  onDisconnect,
  syncing,
  syncResult,
  syncDebug,
  syncProgress,
  backgroundSyncStatus = "idle",
}: IntegrationCardProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleSyncClick() {
    // Try background trigger first, fall back to streaming sync
    if (onSyncTrigger) {
      const triggered = await onSyncTrigger(integration);
      if (triggered) return;
    }
    await onSync(integration);
  }

  const meta = PROVIDER_META[integration.provider];
  const Icon = meta?.icon ?? FileText;
  const status = STATUS_MAP[integration.status] ?? STATUS_MAP.active;

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${meta?.label ?? integration.provider}? This won't delete synced content.`)) {
      return;
    }
    setDisconnecting(true);
    try {
      await onDisconnect(integration);
    } finally {
      setDisconnecting(false);
    }
  }

  const progressPercent =
    syncProgress?.phase === "processing" &&
    syncProgress.current != null &&
    syncProgress.total != null &&
    syncProgress.total > 0
      ? Math.round((syncProgress.current / syncProgress.total) * 100)
      : 0;

  return (
    <Card className="p-4" data-testid={`integration-card-${integration.provider}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`mt-0.5 ${meta?.color ?? "text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">
              {meta?.label ?? integration.provider}
            </span>
            <Badge variant={status.variant} className="text-[10px] px-1.5 py-0" data-testid={`integration-status-${integration.provider}`}>
              {integration.status === "active" && (
                <Check className="h-2.5 w-2.5 mr-0.5" />
              )}
              {integration.status === "error" && (
                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
              )}
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {meta?.description ?? "External integration"}
          </p>
          {integration.last_sync_at && !syncing && backgroundSyncStatus !== "triggered" && backgroundSyncStatus !== "polling" && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Last synced {formatSyncTime(integration.last_sync_at)}
            </p>
          )}

          {/* Background sync status */}
          {(backgroundSyncStatus === "triggered" || backgroundSyncStatus === "polling") && (
            <p className="text-[11px] text-muted-foreground mt-1 animate-pulse">
              Background sync running...
            </p>
          )}
          {backgroundSyncStatus === "complete" && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
              Background sync completed
            </p>
          )}
          {backgroundSyncStatus === "timeout" && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Sync may still be running in the background
            </p>
          )}
          {backgroundSyncStatus === "error" && (
            <p className="text-[11px] text-destructive mt-1">
              Background sync failed — use manual sync
            </p>
          )}

          {/* Auto-sync cadence hint */}
          {integration.status === "active" && !syncing && backgroundSyncStatus === "idle" && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Auto-syncs every 15 min
            </p>
          )}

          {/* Sync progress indicator */}
          {syncing && syncProgress && (
            <div className="mt-2 space-y-1.5" data-testid={`sync-progress-${integration.provider}`}>
              {syncProgress.phase === "fetching" && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {syncProgress.message}
                  </span>
                  <ElapsedTimer active={syncing} />
                </div>
              )}

              {syncProgress.phase === "processing" && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      Processing {syncProgress.current} of {syncProgress.total}
                      {syncProgress.title
                        ? ` \u2014 "${truncateTitle(syncProgress.title)}"`
                        : ""}
                    </span>
                    <ElapsedTimer active={syncing} />
                  </div>
                  <Progress value={progressPercent} className="h-1.5" />
                </>
              )}

              {syncProgress.phase === "error" && (
                <p className="text-xs text-destructive">
                  {syncProgress.message}
                </p>
              )}
            </div>
          )}

          {/* Sync result (shown after sync completes) */}
          {!syncing && syncResult && (
            <p className="text-xs text-muted-foreground mt-1">{syncResult}</p>
          )}
          {!syncing && syncDebug && syncDebug.length > 0 && (
            <div className="mt-2 rounded-md bg-muted p-2 space-y-0.5">
              {syncDebug.map((line, i) => (
                <p key={i} className="text-[11px] text-muted-foreground font-mono">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncClick}
            disabled={syncing || disconnecting || backgroundSyncStatus === "triggered" || backgroundSyncStatus === "polling"}
            className="h-7 text-xs"
            data-testid={`sync-button-${integration.provider}`}
          >
            {syncing || backgroundSyncStatus === "triggered" || backgroundSyncStatus === "polling" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            {syncing
              ? "Syncing..."
              : backgroundSyncStatus === "triggered" || backgroundSyncStatus === "polling"
                ? "Sync requested..."
                : "Sync"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={syncing || disconnecting}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            data-testid={`disconnect-button-${integration.provider}`}
          >
            {disconnecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
