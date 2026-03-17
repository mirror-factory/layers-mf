"use client";

import { useState, useCallback } from "react";
import { GitCommit, Clock, ChevronDown, ChevronRight, FileText } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [fullVersions, setFullVersions] = useState<Record<number, FullVersion>>({});
  const [loadingFull, setLoadingFull] = useState<number | null>(null);

  const fetchVersions = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/context/${itemId}/versions`);
      if (!res.ok) return;
      const data = await res.json();
      setVersions(data.versions);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [itemId, loaded]);

  const toggleOpen = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !loaded) {
      fetchVersions();
    }
  }, [isOpen, loaded, fetchVersions]);

  const toggleExpand = useCallback((versionNumber: number) => {
    setExpandedVersion((prev) => (prev === versionNumber ? null : versionNumber));
  }, []);

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

  if (versionCount === 0) return null;

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
          <Badge variant="secondary" className="ml-auto text-xs">
            {versionCount} {versionCount === 1 ? "version" : "versions"}
          </Badge>
        </button>
      </CardHeader>

      {isOpen && (
        <CardContent>
          {loading && (
            <p className="text-sm text-muted-foreground">Loading versions...</p>
          )}

          {!loading && versions.length === 0 && loaded && (
            <p className="text-sm text-muted-foreground">No version history available.</p>
          )}

          {versions.length > 0 && (
            <div className="relative ml-3">
              {/* Timeline line */}
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {versions.map((v) => {
                  const style = CHANGE_TYPE_STYLES[v.change_type] ?? {
                    label: v.change_type,
                    className: "bg-gray-100 text-gray-800",
                  };
                  const dotColor = CHANGE_TYPE_DOT[v.change_type] ?? "bg-gray-500";
                  const isExpanded = expandedVersion === v.version_number;
                  const full = fullVersions[v.version_number];

                  return (
                    <div
                      key={v.version_number}
                      className="relative pl-6"
                      data-testid={`version-entry-${v.version_number}`}
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-background ${dotColor}`}
                      />

                      <div className="space-y-1">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => toggleExpand(v.version_number)}
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

                        {/* Meta row */}
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

                        {/* Expanded content */}
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
          )}
        </CardContent>
      )}
    </Card>
  );
}
