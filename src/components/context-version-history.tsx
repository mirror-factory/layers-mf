"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GitCommit, Clock, ChevronDown, ChevronRight, FileText, RotateCcw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface VersionSummary {
  version_number: number;
  title: string;
  change_type: string;
  changed_fields: string[];
  changed_by: string | null;
  created_at: string;
  content_preview: string | null;
}

interface DocVersion {
  id: string;
  version_number: number;
  title: string;
  content: string;
  edited_by: string;
  change_summary: string | null;
  created_at: string;
}

interface FullVersion extends VersionSummary {
  raw_content: string | null;
  content_hash: string | null;
  source_metadata: Record<string, unknown> | null;
  source_updated_at: string | null;
}

const CHANGE_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  created: { label: "Created", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  content_updated: { label: "Content Updated", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  metadata_updated: { label: "Metadata Updated", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  status_changed: { label: "Status Changed", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  deleted: { label: "Deleted", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const CHANGE_TYPE_DOT: Record<string, string> = {
  created: "bg-green-500",
  content_updated: "bg-blue-500",
  metadata_updated: "bg-yellow-500",
  status_changed: "bg-purple-500",
  deleted: "bg-red-500",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatChangedBy(changedBy: string | null): string {
  if (!changedBy) return "unknown";
  if (changedBy.startsWith("sync:")) return changedBy.replace("sync:", "Sync: ");
  if (changedBy.startsWith("user:")) return "User edit";
  if (changedBy.startsWith("webhook:")) return changedBy.replace("webhook:", "Webhook: ");
  return changedBy;
}

interface ContextVersionHistoryProps {
  itemId: string;
  versionCount: number;
}

export function ContextVersionHistory({ itemId, versionCount }: ContextVersionHistoryProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Sync versions (context_item_versions)
  const [syncVersions, setSyncVersions] = useState<VersionSummary[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncLoaded, setSyncLoaded] = useState(false);
  const [expandedSyncVersion, setExpandedSyncVersion] = useState<number | null>(null);
  const [fullVersions, setFullVersions] = useState<Record<number, FullVersion>>({});
  const [loadingFull, setLoadingFull] = useState<number | null>(null);

  // Document edit versions (document_versions)
  const [docVersions, setDocVersions] = useState<DocVersion[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docLoaded, setDocLoaded] = useState(false);
  const [expandedDocVersion, setExpandedDocVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchSyncVersions = useCallback(async () => {
    if (syncLoaded) return;
    setSyncLoading(true);
    try {
      const res = await fetch(`/api/context/${itemId}/versions`);
      if (!res.ok) return;
      const data = await res.json();
      setSyncVersions(data.versions);
      setSyncLoaded(true);
    } finally {
      setSyncLoading(false);
    }
  }, [itemId, syncLoaded]);

  const fetchDocVersions = useCallback(async () => {
    if (docLoaded) return;
    setDocLoading(true);
    try {
      const res = await fetch(`/api/context/${itemId}/doc-versions`);
      if (!res.ok) return;
      const data = await res.json();
      setDocVersions(data.versions);
      setDocLoaded(true);
    } finally {
      setDocLoading(false);
    }
  }, [itemId, docLoaded]);

  const toggleOpen = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !syncLoaded) {
      fetchSyncVersions();
    }
    if (next && !docLoaded) {
      fetchDocVersions();
    }
  }, [isOpen, syncLoaded, docLoaded, fetchSyncVersions, fetchDocVersions]);

  const fetchFullVersion = useCallback(
    async (versionNumber: number) => {
      if (fullVersions[versionNumber]) return;
      setLoadingFull(versionNumber);
      try {
        const res = await fetch(`/api/context/${itemId}/versions/${versionNumber}`);
        if (!res.ok) return;
        const data = await res.json();
        setFullVersions((prev) => ({ ...prev, [versionNumber]: data }));
      } finally {
        setLoadingFull(null);
      }
    },
    [itemId, fullVersions],
  );

  const handleRestore = useCallback(
    async (version: DocVersion) => {
      setRestoring(version.version_number);
      setRestoreMessage(null);
      try {
        const res = await fetch(`/api/context/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw_content: version.content,
            title: version.title,
            change_summary: `Restored from version ${version.version_number}`,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Restore failed" }));
          throw new Error(data.error ?? "Restore failed");
        }
        setRestoreMessage({ text: `Restored to v${version.version_number}`, ok: true });
        // Reset doc versions cache so next open refetches
        setDocLoaded(false);
        setDocVersions([]);
        // Refresh the page to show restored content
        router.refresh();
        setTimeout(() => setRestoreMessage(null), 3000);
      } catch (err) {
        setRestoreMessage({
          text: err instanceof Error ? err.message : "Restore failed",
          ok: false,
        });
      } finally {
        setRestoring(null);
      }
    },
    [itemId, router],
  );

  const totalCount = versionCount + docVersions.length;
  const displayCount = syncLoaded || docLoaded
    ? syncVersions.length + docVersions.length
    : versionCount;

  if (versionCount === 0 && docVersions.length === 0 && docLoaded) return null;
  // Show the component if there are sync versions or we haven't checked doc versions yet
  if (versionCount === 0 && !docLoaded) {
    // Still fetch doc versions when opened
  }

  return (
    <Card data-testid="context-version-history">
      <CardHeader className="pb-3">
        <button
          onClick={toggleOpen}
          className="flex items-center gap-2 w-full text-left"
          data-testid="version-history-toggle"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            Version History
          </CardTitle>
          {displayCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {displayCount} {displayCount === 1 ? "version" : "versions"}
            </Badge>
          )}
        </button>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-6">
          {restoreMessage && (
            <p
              className={`text-sm font-medium ${restoreMessage.ok ? "text-green-600" : "text-destructive"}`}
              data-testid="restore-message"
            >
              {restoreMessage.text}
            </p>
          )}

          {/* Document Edit Versions (document_versions table) */}
          {docLoading && (
            <p className="text-sm text-muted-foreground">Loading edit history...</p>
          )}

          {docVersions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Edit History
              </h3>
              <div className="relative ml-3">
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-4">
                  {docVersions.map((v) => {
                    const isExpanded = expandedDocVersion === v.version_number;
                    return (
                      <div
                        key={`doc-${v.version_number}`}
                        className="relative pl-6"
                        data-testid={`doc-version-entry-${v.version_number}`}
                      >
                        <div className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-background bg-blue-500" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() =>
                                setExpandedDocVersion((prev) =>
                                  prev === v.version_number ? null : v.version_number
                                )
                              }
                              className="flex items-center gap-1.5 hover:underline text-sm font-medium"
                            >
                              <span className="text-muted-foreground text-xs">
                                v{v.version_number}
                              </span>
                              {v.title}
                            </button>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-0 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            >
                              Edit
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {relativeTime(v.created_at)}
                            </span>
                            {v.change_summary && (
                              <span>{v.change_summary}</span>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-2 space-y-2">
                              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {v.content}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => handleRestore(v)}
                                disabled={restoring === v.version_number}
                                data-testid={`restore-version-${v.version_number}`}
                              >
                                {restoring === v.version_number ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                {restoring === v.version_number ? "Restoring..." : "Restore this version"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sync Versions (context_item_versions table) */}
          {syncLoading && (
            <p className="text-sm text-muted-foreground">Loading sync versions...</p>
          )}

          {!syncLoading && !docLoading && syncVersions.length === 0 && docVersions.length === 0 && syncLoaded && docLoaded && (
            <p className="text-sm text-muted-foreground">No version history available.</p>
          )}

          {syncVersions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Sync History
              </h3>
              <div className="relative ml-3">
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-4">
                  {syncVersions.map((v) => {
                    const style = CHANGE_TYPE_STYLES[v.change_type] ?? {
                      label: v.change_type,
                      className: "bg-gray-100 text-gray-800",
                    };
                    const dotColor = CHANGE_TYPE_DOT[v.change_type] ?? "bg-gray-500";
                    const isExpanded = expandedSyncVersion === v.version_number;
                    const full = fullVersions[v.version_number];

                    return (
                      <div
                        key={v.version_number}
                        className="relative pl-6"
                        data-testid={`version-entry-${v.version_number}`}
                      >
                        <div
                          className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-background ${dotColor}`}
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() =>
                                setExpandedSyncVersion((prev) =>
                                  prev === v.version_number ? null : v.version_number
                                )
                              }
                              className="flex items-center gap-1.5 hover:underline text-sm font-medium"
                            >
                              <span className="text-muted-foreground text-xs">
                                v{v.version_number}
                              </span>
                              {v.title}
                            </button>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 border-0 ${style.className}`}
                            >
                              {style.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {relativeTime(v.created_at)}
                            </span>
                            <span>{formatChangedBy(v.changed_by)}</span>
                            {v.changed_fields.length > 0 && (
                              <span className="text-muted-foreground/70">
                                [{v.changed_fields.join(", ")}]
                              </span>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-2 space-y-2">
                              {v.content_preview && (
                                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                                  {full?.raw_content ?? v.content_preview}
                                  {!full && v.content_preview.length >= 200 && (
                                    <span className="text-muted-foreground/50">...</span>
                                  )}
                                </div>
                              )}
                              {!full && v.content_preview && v.content_preview.length >= 200 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={() => fetchFullVersion(v.version_number)}
                                  disabled={loadingFull === v.version_number}
                                >
                                  <FileText className="h-3 w-3" />
                                  {loadingFull === v.version_number
                                    ? "Loading..."
                                    : "View full content"}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
