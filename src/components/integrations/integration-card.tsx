"use client";

import { useState } from "react";
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

export interface Integration {
  id: string;
  provider: string;
  nango_connection_id: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
}

interface IntegrationCardProps {
  integration: Integration;
  onSync: (integration: Integration) => Promise<void>;
  onDisconnect: (integration: Integration) => Promise<void>;
  syncing: boolean;
  syncResult?: string;
  syncDebug?: string[];
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
    description: "Documents and files",
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

export function IntegrationCard({
  integration,
  onSync,
  onDisconnect,
  syncing,
  syncResult,
  syncDebug,
}: IntegrationCardProps) {
  const [disconnecting, setDisconnecting] = useState(false);

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
          {integration.last_sync_at && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Last synced {formatSyncTime(integration.last_sync_at)}
            </p>
          )}
          {syncResult && (
            <p className="text-xs text-muted-foreground mt-1">{syncResult}</p>
          )}
          {syncDebug && syncDebug.length > 0 && (
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
            onClick={() => onSync(integration)}
            disabled={syncing || disconnecting}
            className="h-7 text-xs"
            data-testid={`sync-button-${integration.provider}`}
          >
            {syncing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            {syncing ? "Syncing…" : "Sync"}
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
