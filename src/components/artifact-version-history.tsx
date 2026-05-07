"use client";

import { useState, useEffect } from "react";
import { Clock, RotateCcw, Bot, User, Loader2, DollarSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Version {
  id: string;
  version_number: number;
  change_summary: string | null;
  change_type: string;
  cost_usd: number;
  created_by_ai: boolean;
  model_used: string | null;
  created_at: string;
}

interface ArtifactVersionHistoryProps {
  artifactId: string;
  currentVersion: number;
  onRestore?: (versionNumber: number) => void;
  onSelect?: (versionNumber: number) => void;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ArtifactVersionHistory({
  artifactId,
  currentVersion,
  onRestore,
  onSelect,
  className,
}: ArtifactVersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion);

  useEffect(() => {
    fetch(`/api/artifacts/${artifactId}/versions`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.versions) setVersions(data.versions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [artifactId, currentVersion]);

  async function handleRestore(versionNumber: number) {
    setRestoring(versionNumber);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_number: versionNumber }),
      });
      if (res.ok) {
        const data = await res.json();
        onRestore?.(data.new_version);
      }
    } catch { /* silent */ }
    setRestoring(null);
  }

  async function handleDeleteVersion(versionNumber: number) {
    if (!confirm(`Delete version ${versionNumber}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/artifacts/${artifactId}/versions/${versionNumber}`, { method: "DELETE" });
      setVersions(prev => prev.filter(v => v.version_number !== versionNumber));
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground text-center py-4", className)}>
        No version history yet.
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1.5 px-2 pb-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Version History</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{versions.length} versions</span>
      </div>

      <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
        {versions.map((v) => {
          // "current" = highest version number (not the prop, which may be stale)
          const latestVersion = versions.length > 0 ? Math.max(...versions.map(ver => ver.version_number)) : 1;
          const isCurrent = v.version_number === latestVersion;
          const isSelected = v.version_number === selectedVersion;

          return (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedVersion(v.version_number);
                onSelect?.(v.version_number);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { setSelectedVersion(v.version_number); onSelect?.(v.version_number); } }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer",
                isSelected ? "bg-primary/10" : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-medium text-muted-foreground w-6">
                  v{v.version_number}
                </span>
                {isCurrent && (
                  <span className="text-[9px] text-primary font-medium px-1 border border-primary/30 rounded">
                    current
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {timeAgo(v.created_at)}
                </span>
              </div>

              {v.change_summary && (
                <p className="text-[10px] text-muted-foreground mt-0.5 ml-7 line-clamp-1">
                  {v.change_summary}
                </p>
              )}

              <div className="flex items-center gap-2 mt-0.5 ml-7">
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  {v.change_type === "create" ? (
                    <><span className="text-primary">Created</span></>
                  ) : v.change_type === "ai_edit" ? (
                    <><Bot className="h-2.5 w-2.5" /> {v.model_used?.split("/")[1] ?? "AI"}</>
                  ) : v.change_type === "restore" ? (
                    <><RotateCcw className="h-2.5 w-2.5" /> Restored</>
                  ) : v.created_by_ai ? (
                    <><Bot className="h-2.5 w-2.5" /> AI</>
                  ) : (
                    <><User className="h-2.5 w-2.5" /> Manual</>
                  )}
                </span>
                {v.cost_usd > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    <DollarSign className="h-2.5 w-2.5" />{v.cost_usd.toFixed(4)}
                  </span>
                )}
                {!isCurrent && isSelected && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-[9px] px-1.5 ml-auto text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(v.version_number);
                      }}
                      disabled={restoring !== null}
                    >
                      {restoring === v.version_number ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <><RotateCcw className="h-2.5 w-2.5 mr-0.5" /> Restore</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-[9px] px-1.5 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVersion(v.version_number);
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
