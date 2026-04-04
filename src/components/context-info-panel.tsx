"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  HardDrive,
  Github,
  Upload,
  Hash,
  GitBranch,
  Mic,
  Mail,
  Brain,
  ExternalLink,
  Loader2,
  Clock,
  Copy,
  Check,
  MessageSquare,
  Share2,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TagManager } from "@/components/tag-manager";

const SOURCE_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  "google-drive": {
    label: "Google Drive",
    icon: HardDrive,
    color: "text-blue-500",
  },
  gdrive: { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  github: { label: "GitHub", icon: Github, color: "text-slate-400" },
  "github-app": { label: "GitHub", icon: Github, color: "text-slate-400" },
  slack: { label: "Slack", icon: Hash, color: "text-purple-500" },
  granola: { label: "Granola", icon: Mic, color: "text-orange-500" },
  gmail: { label: "Gmail", icon: Mail, color: "text-red-500" },
  linear: { label: "Linear", icon: GitBranch, color: "text-indigo-500" },
  upload: { label: "Uploads", icon: Upload, color: "text-green-600" },
  "layers-ai": { label: "AI Generated", icon: Brain, color: "text-primary" },
};

interface ContextInfoPanelProps {
  item: {
    id: string;
    title: string;
    description_short: string | null;
    source_type: string;
    content_type: string;
    status: string;
    ingested_at: string;
    user_tags?: string[] | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VersionEntry {
  version_number: number;
  title: string;
  change_type: string | null;
  changed_fields: string[];
  changed_by: string | null;
  created_at: string;
  content_preview: string | null;
}

export function ContextInfoPanel({
  item,
  open,
  onOpenChange,
}: ContextInfoPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [fullItem, setFullItem] = useState<Record<string, unknown> | null>(
    null,
  );

  // Fetch full item details + content
  useEffect(() => {
    if (!item || !open) {
      setContent(null);
      setFullItem(null);
      setVersions([]);
      setShowVersions(false);
      return;
    }
    setLoading(true);
    fetch(`/api/context/${item.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setContent(data?.raw_content ?? null);
        setFullItem(data);
        setTags(data?.user_tags ?? item.user_tags ?? []);
      })
      .catch(() => {
        setContent(null);
        setFullItem(null);
      })
      .finally(() => setLoading(false));
  }, [item?.id, open, item]);

  // Save tags
  const handleTagsChange = useCallback(
    async (newTags: string[]) => {
      if (!item) return;
      setTags(newTags);
      setSavingTags(true);
      try {
        await fetch(`/api/context/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_tags: newTags }),
        });
      } catch {
        // revert on error
        setTags(item.user_tags ?? []);
      } finally {
        setSavingTags(false);
      }
    },
    [item],
  );

  // Fetch version history
  const loadVersions = useCallback(async () => {
    if (!item) return;
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/context/${item.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      }
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, [item]);

  const handleToggleVersions = useCallback(() => {
    if (!showVersions && versions.length === 0) {
      loadVersions();
    }
    setShowVersions((v) => !v);
  }, [showVersions, versions.length, loadVersions]);

  if (!item) return null;

  const source = SOURCE_META[item.source_type] ?? {
    label: item.source_type,
    icon: FileText,
    color: "text-muted-foreground",
  };
  const SourceIcon = source.icon;

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/context/${item.id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          {/* Source / type / status badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary" className="gap-1.5">
              <SourceIcon className={cn("h-3 w-3", source.color)} />
              {source.label}
            </Badge>
            <Badge variant="outline">
              {item.content_type.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant={item.status === "ready" ? "default" : "secondary"}
            >
              {item.status}
            </Badge>
          </div>

          <SheetTitle className="text-left text-lg leading-snug">
            {item.title}
          </SheetTitle>
          {item.description_short && (
            <SheetDescription className="text-left">
              {item.description_short}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Metadata fields */}
        <div className="space-y-4 mt-2">
          {/* Date */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {new Date(item.ingested_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Additional metadata from full item */}
          {fullItem && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {fullItem.source_id != null && (
                <div>
                  <span className="text-muted-foreground">Source ID</span>
                  <p className="font-mono text-[11px] truncate">
                    {String(fullItem.source_id)}
                  </p>
                </div>
              )}
              {fullItem.processed_at != null && (
                <div>
                  <span className="text-muted-foreground">Processed</span>
                  <p>
                    {new Date(
                      String(fullItem.processed_at),
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              {fullItem.entities != null && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Entities</span>
                  <p className="line-clamp-2">
                    {typeof fullItem.entities === "string"
                      ? String(fullItem.entities)
                      : JSON.stringify(fullItem.entities)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Editable tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-medium">Tags</h3>
              {savingTags && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <TagManager tags={tags} onChange={handleTagsChange} />
          </div>

          {/* Content preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Content Preview</h3>
              {content && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5 text-xs h-7"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : content ? (
              <pre className="rounded-lg border bg-muted/30 p-4 text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                {content.slice(0, 3000)}
                {content.length > 3000 && "\n\n... (truncated)"}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No content available.
              </p>
            )}
          </div>

          {/* Version History */}
          <div>
            <button
              onClick={handleToggleVersions}
              className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
            >
              <History className="h-4 w-4" />
              Version History
              {versions.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {versions.length}
                </Badge>
              )}
            </button>

            {showVersions && (
              <div className="mt-2 space-y-1">
                {versionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No version history available.
                  </p>
                ) : (
                  versions.map((v) => (
                    <div
                      key={v.version_number}
                      className="flex items-start gap-2 rounded-md border p-2 text-xs"
                    >
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 mt-0.5"
                      >
                        v{v.version_number}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {v.change_type || "edit"}
                        </p>
                        {v.changed_fields.length > 0 && (
                          <p className="text-muted-foreground">
                            Changed: {v.changed_fields.join(", ")}
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description long from fullItem */}
        {fullItem && typeof fullItem.description_long === "string" && (
          <div>
            <h3 className="text-sm font-medium mb-1.5">Summary</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {String(fullItem.description_long).slice(0, 500)}
              {String(fullItem.description_long).length > 500 && "..."}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <Button asChild className="flex-1 min-w-[120px]">
            <Link href={`/chat?context=${item.id}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Open in Chat
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 min-w-[120px]">
            <Link href={`/context/${item.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Detail
            </Link>
          </Button>
          <Button variant="outline" size="icon" onClick={handleShare} title="Copy link">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
