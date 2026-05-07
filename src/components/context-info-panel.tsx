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
  History,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Eye,
  FolderPlus,
  Tag,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { TagManager } from "@/components/tag-manager";
import { ShareLinkButton } from "@/components/share-link-button";

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
    is_pinned?: boolean;
    is_archived?: boolean;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPin?: (id: string, pinned: boolean) => void;
  onArchive?: (id: string, archived: boolean) => void;
  onTagClick?: (tag: string) => void;
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

interface Collection {
  id: string;
  name: string;
}

interface FullItem {
  id: string;
  title: string;
  description_short: string | null;
  description_long: string | null;
  source_type: string;
  source_id: string | null;
  content_type: string;
  raw_content: string | null;
  entities: unknown;
  status: string;
  ingested_at: string;
  processed_at: string | null;
  user_tags: string[] | null;
  last_viewed_at: string | null;
  view_count: number | null;
  is_pinned: boolean | null;
  is_archived: boolean | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContextInfoPanel({
  item,
  open,
  onOpenChange,
  onPin,
  onArchive,
  onTagClick,
}: ContextInfoPanelProps) {
  const [fullItem, setFullItem] = useState<FullItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);

  // Fetch full item details + update last_viewed_at
  useEffect(() => {
    if (!item || !open) {
      setFullItem(null);
      setVersions([]);
      setShowVersions(false);
      return;
    }
    setLoading(true);
    fetch(`/api/context/${item.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FullItem | null) => {
        setFullItem(data);
        setTags(data?.user_tags ?? item.user_tags ?? []);
      })
      .catch(() => {
        setFullItem(null);
      })
      .finally(() => setLoading(false));

    // Fire-and-forget: update last_viewed_at and increment view_count
    fetch(`/api/context/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_viewed_at: new Date().toISOString(),
      }),
    }).catch(() => {});
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

  // Fetch collections for dropdown
  const loadCollections = useCallback(async () => {
    if (collectionsLoaded) return;
    try {
      const res = await fetch("/api/collections");
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections ?? data ?? []);
        setCollectionsLoaded(true);
      }
    } catch {
      setCollections([]);
    }
  }, [collectionsLoaded]);

  const handleAddToCollection = useCallback(
    async (collectionId: string) => {
      if (!item) return;
      try {
        await fetch(`/api/collections/${collectionId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context_item_id: item.id }),
        });
      } catch {
        // silently fail
      }
    },
    [item],
  );

  if (!item) return null;

  const source = SOURCE_META[item.source_type] ?? {
    label: item.source_type,
    icon: FileText,
    color: "text-muted-foreground",
  };
  const SourceIcon = source.icon;

  const content = fullItem?.raw_content ?? null;

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePin = () => {
    onPin?.(item.id, !item.is_pinned);
  };

  const handleArchive = () => {
    onArchive?.(item.id, !item.is_archived);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-[400px] p-0 flex flex-col"
        side="right"
      >
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Header */}
            <SheetHeader className="pb-0 space-y-3">
              {/* Source + content type + status badges */}
              <div className="flex items-center gap-2 flex-wrap">
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

              <SheetTitle className="text-left text-xl leading-snug font-semibold">
                {item.title}
              </SheetTitle>
              {item.description_short && (
                <SheetDescription className="text-left text-sm">
                  {item.description_short}
                </SheetDescription>
              )}
            </SheetHeader>

            {/* Action buttons row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={item.is_pinned ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handlePin}
              >
                {item.is_pinned ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
                {item.is_pinned ? "Unpin" : "Pin"}
              </Button>
              <Button
                variant={item.is_archived ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleArchive}
              >
                {item.is_archived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                {item.is_archived ? "Unarchive" : "Archive"}
              </Button>
              <ShareLinkButton
                resourceType="context_item"
                resourceId={item.id}
                resourceTitle={item.title}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
              />
              <DropdownMenu onOpenChange={(isOpen) => { if (isOpen) loadCollections(); }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    Add to collection
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {collections.length === 0 ? (
                    <DropdownMenuItem disabled>
                      {collectionsLoaded
                        ? "No collections yet"
                        : "Loading..."}
                    </DropdownMenuItem>
                  ) : (
                    collections.map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        onClick={() => handleAddToCollection(col.id)}
                      >
                        {col.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-medium">Tags</h3>
                {savingTags && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              {onTagClick && tags.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => onTagClick(tag)}
                        className="inline-flex items-center gap-0.5 rounded-full bg-primary/5 border border-primary/10 px-2 py-0.5 text-xs font-normal text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </button>
                    ))}
                  </div>
                  <TagManager tags={tags} onChange={handleTagsChange} />
                </div>
              ) : (
                <TagManager tags={tags} onChange={handleTagsChange} />
              )}
            </div>

            {/* Metadata */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Details</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">
                    Created
                  </span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{formatDate(item.ingested_at)}</span>
                  </div>
                </div>

                {fullItem?.last_viewed_at && (
                  <div>
                    <span className="text-muted-foreground block mb-0.5">
                      Last viewed
                    </span>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <span>{formatDate(fullItem.last_viewed_at)}</span>
                    </div>
                  </div>
                )}

                {fullItem?.processed_at && (
                  <div>
                    <span className="text-muted-foreground block mb-0.5">
                      Processed
                    </span>
                    <span>
                      {formatDate(fullItem.processed_at)}
                    </span>
                  </div>
                )}

                {fullItem?.view_count != null && fullItem.view_count > 0 && (
                  <div>
                    <span className="text-muted-foreground block mb-0.5">
                      Views
                    </span>
                    <span>{fullItem.view_count}</span>
                  </div>
                )}

                {fullItem?.source_id && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block mb-0.5">
                      Source ID
                    </span>
                    <p className="font-mono text-[11px] truncate">
                      {fullItem.source_id}
                    </p>
                  </div>
                )}

                {fullItem?.entities != null && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block mb-0.5">
                      Entities
                    </span>
                    <p className="line-clamp-2">
                      {typeof fullItem.entities === "string"
                        ? fullItem.entities
                        : JSON.stringify(fullItem.entities)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Summary from description_long */}
            {fullItem?.description_long && (
              <div>
                <h3 className="text-sm font-medium mb-1.5">Summary</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {fullItem.description_long.slice(0, 500)}
                  {fullItem.description_long.length > 500 && "..."}
                </p>
              </div>
            )}

            {/* Content preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Content</h3>
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
                <div className="rounded-lg border bg-muted/30 p-4 max-h-[400px] overflow-y-auto">
                  <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap break-words font-mono">
                    {content}
                  </div>
                </div>
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
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1.5"
                  >
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
                            {new Date(v.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Related Items placeholder */}
            <div>
              <h3 className="text-sm font-medium mb-1.5">Related Items</h3>
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Coming soon -- related items will appear here based on semantic similarity.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Sticky bottom actions */}
        <div className="border-t bg-background p-4 flex items-center gap-2 shrink-0">
          <Button asChild className="flex-1">
            <Link href={`/chat?context=${item.id}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Open in Chat
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/context/${item.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Detail
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
