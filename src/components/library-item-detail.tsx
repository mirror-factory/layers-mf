"use client";

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Code,
  MessageSquare,
  Globe,
  Loader2,
  Check,
  X,
  Pencil,
  RefreshCw,
  Share2,
  Clock,
  Plus,
  History,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types ---------- */

export interface LibraryItemDetailProps {
  itemId: string;
  onClose: () => void;
}

interface ItemDetail {
  id: string;
  title: string;
  source_type: string;
  content_type?: string;
  raw_content?: string;
  created_at?: string;
  updated_at?: string;
  ingested_at?: string;
  user_tags?: string[] | null;
  category?: string | null;
  source_url?: string | null;
  source_id?: string | null;
  embedded?: boolean;
  embedding_model?: string | null;
}

interface Interaction {
  id: string;
  action: string;
  user_email?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface ShareEntry {
  id: string;
  user_email: string;
  permission: "read" | "write" | "admin";
  created_at: string;
}

/* ---------- Constants ---------- */

const SOURCE_TYPE_ICON: Record<string, React.ElementType> = {
  document: FileText,
  doc: FileText,
  artifact: Code,
  code: Code,
  conversation: MessageSquare,
  message: MessageSquare,
  web: Globe,
  url: Globe,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  document: "Document",
  doc: "Document",
  artifact: "Artifact",
  code: "Artifact",
  conversation: "Conversation",
  message: "Conversation",
  web: "Web",
  url: "Web",
};

const CATEGORIES = [
  "uncategorized",
  "engineering",
  "design",
  "product",
  "marketing",
  "sales",
  "support",
  "legal",
  "finance",
  "hr",
  "other",
];

const PERMISSION_BADGE: Record<string, string> = {
  read: "bg-blue-500/10 text-blue-700 border-blue-200",
  write: "bg-green-500/10 text-green-700 border-green-200",
  admin: "bg-purple-500/10 text-purple-700 border-purple-200",
};

function getSourceIcon(sourceType: string): React.ElementType {
  return SOURCE_TYPE_ICON[sourceType] ?? FileText;
}

function getSourceLabel(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType;
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

/* ---------- EditableTitle ---------- */

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (newTitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="text-lg font-semibold"
        data-testid="title-input"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 text-left"
      data-testid="editable-title"
    >
      <h2 className="text-lg font-semibold">{value}</h2>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

/* ---------- TagChips ---------- */

function TagChips({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleAdd = () => {
    const trimmed = newTag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setNewTag("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-background/50 transition-colors"
            aria-label={`Remove tag ${tag}`}
            data-testid={`remove-tag-${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <Input
          ref={inputRef}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onBlur={handleAdd}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
            if (e.key === "Escape") {
              setNewTag("");
              setAdding(false);
            }
          }}
          className="h-6 w-24 text-xs"
          placeholder="new tag"
          data-testid="new-tag-input"
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
          className="h-6 px-2 text-xs"
          data-testid="add-tag-button"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      )}
    </div>
  );
}

/* ---------- SectionHeader ---------- */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
      {children}
    </h3>
  );
}

/* ---------- LibraryItemDetail ---------- */

export function LibraryItemDetail({ itemId, onClose }: LibraryItemDetailProps) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [reEmbedding, setReEmbedding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch item detail
  const fetchItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/context/${itemId}`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setItem(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load item");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  // Fetch interactions (for artifacts)
  const fetchInteractions = useCallback(async () => {
    try {
      const res = await fetch(`/api/context/${itemId}/interactions`);
      if (res.ok) {
        const data = await res.json();
        setInteractions(Array.isArray(data) ? data : (data.interactions ?? []));
      }
    } catch {
      // non-critical, ignore
    }
  }, [itemId]);

  // Fetch sharing info
  const fetchShares = useCallback(async () => {
    try {
      const res = await fetch(`/api/context/${itemId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(Array.isArray(data) ? data : (data.shares ?? []));
      }
    } catch {
      // non-critical, ignore
    }
  }, [itemId]);

  useEffect(() => {
    fetchItem();
    fetchInteractions();
    fetchShares();
  }, [fetchItem, fetchInteractions, fetchShares]);

  // Update a field on the item
  const updateItem = useCallback(
    async (updates: Partial<ItemDetail>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/context/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to save");
        const data = await res.json();
        setItem((prev) => (prev ? { ...prev, ...data } : data));
      } catch {
        // Could show toast here
      } finally {
        setSaving(false);
      }
    },
    [itemId]
  );

  // Re-embed
  const handleReEmbed = useCallback(async () => {
    setReEmbedding(true);
    try {
      await fetch(`/api/context/${itemId}/embed`, { method: "POST" });
      await fetchItem();
    } catch {
      // Could show error toast
    } finally {
      setReEmbedding(false);
    }
  }, [itemId, fetchItem]);

  const Icon = item ? getSourceIcon(item.source_type) : FileText;
  const contentPreview = item?.raw_content
    ? item.raw_content.slice(0, 500)
    : null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-hidden flex flex-col"
        data-testid="library-item-detail"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Item Detail</SheetTitle>
          <SheetDescription>View and edit library item details</SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex-1 space-y-4 p-1" data-testid="detail-loading">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={fetchItem}
                className="mt-2 text-sm text-primary underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {item && !loading && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-6">
              {/* Header */}
              <div data-testid="detail-header">
                <EditableTitle
                  value={item.title}
                  onSave={(title) => updateItem({ title })}
                />
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">
                      {getSourceLabel(item.source_type)}
                    </Badge>
                  </div>
                  {item.created_at && (
                    <span className="text-xs text-muted-foreground">
                      Created {formatDate(item.created_at)}
                    </span>
                  )}
                  {item.updated_at && (
                    <span className="text-xs text-muted-foreground">
                      Modified {formatDate(item.updated_at)}
                    </span>
                  )}
                  {saving && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              <Separator />

              {/* Content preview */}
              {contentPreview && (
                <div data-testid="content-preview">
                  <SectionHeader>Content Preview</SectionHeader>
                  <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/50 p-3">
                    <pre className="whitespace-pre-wrap text-xs text-foreground font-mono">
                      {contentPreview}
                      {item.raw_content && item.raw_content.length > 500 && (
                        <span className="text-muted-foreground">
                          {"\n"}... ({item.raw_content.length - 500} more chars)
                        </span>
                      )}
                    </pre>
                  </div>
                </div>
              )}

              <Separator />

              {/* Metadata */}
              <div data-testid="metadata-section">
                <SectionHeader>Metadata</SectionHeader>
                <div className="space-y-3">
                  {/* Tags */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Tags
                    </label>
                    <TagChips
                      tags={item.user_tags ?? []}
                      onAdd={(tag) => {
                        const newTags = [...(item.user_tags ?? []), tag];
                        setItem((prev) =>
                          prev ? { ...prev, user_tags: newTags } : prev
                        );
                        updateItem({ user_tags: newTags } as Partial<ItemDetail>);
                      }}
                      onRemove={(tag) => {
                        const newTags = (item.user_tags ?? []).filter(
                          (t) => t !== tag
                        );
                        setItem((prev) =>
                          prev ? { ...prev, user_tags: newTags } : prev
                        );
                        updateItem({ user_tags: newTags } as Partial<ItemDetail>);
                      }}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Category
                    </label>
                    <Select
                      value={item.category ?? "uncategorized"}
                      onValueChange={(v) => {
                        setItem((prev) =>
                          prev ? { ...prev, category: v } : prev
                        );
                        updateItem({ category: v });
                      }}
                    >
                      <SelectTrigger className="w-full" data-testid="category-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Source info */}
                  {item.source_url && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Source
                      </label>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Open source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Embedding info */}
              <div data-testid="embedding-section">
                <SectionHeader>Embedding</SectionHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      item.embedded
                        ? "bg-green-500/10 text-green-700 border-green-200"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.embedded ? "Embedded" : "Not embedded"}
                  </Badge>
                  {item.embedding_model && (
                    <span className="text-xs text-muted-foreground">
                      {item.embedding_model}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReEmbed}
                    disabled={reEmbedding}
                    className="ml-auto"
                    data-testid="re-embed-button"
                  >
                    {reEmbedding ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Re-embed
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Interaction history (artifacts only) */}
              {(item.source_type === "artifact" ||
                item.source_type === "code") &&
                interactions.length > 0 && (
                  <>
                    <div data-testid="interaction-history">
                      <SectionHeader>Interaction History</SectionHeader>
                      <div className="space-y-2">
                        {interactions.map((ix) => (
                          <div
                            key={ix.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs">
                                <span className="font-medium">
                                  {ix.user_email ?? "Unknown"}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {ix.action}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(ix.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

              {/* Sharing */}
              <div data-testid="sharing-section">
                <SectionHeader>Sharing</SectionHeader>
                {shares.length > 0 ? (
                  <div className="space-y-2">
                    {shares.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">{s.user_email}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] ml-2",
                            PERMISSION_BADGE[s.permission] ?? ""
                          )}
                        >
                          {s.permission}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not shared with anyone
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  data-testid="share-button"
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  Share
                </Button>
              </div>

              {/* Version history (artifacts only) */}
              {(item.source_type === "artifact" ||
                item.source_type === "code") && (
                <>
                  <Separator />
                  <div data-testid="version-history">
                    <SectionHeader>Version History</SectionHeader>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`/context/${itemId}/versions`}
                        className="inline-flex items-center"
                      >
                        <History className="h-3 w-3 mr-1" />
                        View versions
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
