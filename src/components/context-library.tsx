"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  FileText,
  HardDrive,
  Github,
  Upload,
  Hash,
  LayoutGrid,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
  FileSpreadsheet,
  FileVideo,
  MessageSquare,
  GitBranch,
  Mic,
  Filter,
  X,
  Download,
  Trash2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SavedSearches } from "@/components/saved-searches";
import { ExportDropdown } from "@/components/export-dropdown";

interface ContextItem {
  id: string;
  title: string;
  description_short: string | null;
  source_type: string;
  content_type: string;
  status: string;
  ingested_at: string;
  user_tags?: string[] | null;
}

interface Props {
  items: ContextItem[];
  initialSearch?: string;
}

const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "google-drive": { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  gdrive:         { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  github:         { label: "GitHub",       icon: Github,    color: "text-slate-600" },
  "github-app":   { label: "GitHub",       icon: Github,    color: "text-slate-600" },
  slack:          { label: "Slack",        icon: Hash,      color: "text-purple-500" },
  granola:        { label: "Granola",      icon: Mic,       color: "text-orange-500" },
  linear:         { label: "Linear",       icon: GitBranch, color: "text-indigo-500" },
  upload:         { label: "Uploads",      icon: Upload,    color: "text-green-600" },
};

const CONTENT_TYPE_ICON: Record<string, React.ElementType> = {
  meeting_transcript: Mic,
  document:           FileText,
  issue:              GitBranch,
  message:            MessageSquare,
  spreadsheet:        FileSpreadsheet,
  video:              FileVideo,
};

const STATUS_CONFIG = {
  ready:      { icon: CheckCircle, className: "text-green-600" },
  processing: { icon: Loader,      className: "text-blue-500 animate-spin" },
  pending:    { icon: Clock,       className: "text-muted-foreground" },
  error:      { icon: AlertCircle, className: "text-destructive" },
} as const;

type SortOption = "newest" | "oldest" | "title-az";

const PAGE_SIZE = 20;

function normalizeSource(source: string) {
  if (source === "gdrive") return "google-drive";
  if (source === "github-app") return "github";
  return source;
}

export function ContextLibrary({ items, initialSearch = "" }: Props) {
  if (items.length === 0) {
    return (
      <div data-testid="context-empty-state" className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm font-medium text-foreground">No documents yet</p>
        <p className="text-xs mt-1 max-w-xs text-center">
          Connect an integration or upload files to start building your knowledge base.
        </p>
        <div className="flex gap-2 mt-4">
          <Button asChild size="sm">
            <Link href="/integrations">Connect integration</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/context?upload=true">
              <Upload className="h-4 w-4 mr-1" />
              Upload files
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const router = useRouter();
  const [selected, setSelected] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Derive unique content types from items
  const contentTypes = useMemo(
    () => [...new Set(items.map((i) => i.content_type))].sort(),
    [items],
  );

  // Group items by normalized source
  const groups = useMemo(
    () =>
      items.reduce<Record<string, ContextItem[]>>((acc, item) => {
        const key = normalizeSource(item.source_type);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {}),
    [items],
  );

  const sources = Object.keys(groups).sort();

  // Filter → search → sort → paginate
  const processed = useMemo(() => {
    let result = selected === "all" ? items : (groups[selected] ?? []);

    if (contentTypeFilter !== "all") {
      result = result.filter((i) => i.content_type === contentTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.description_short && i.description_short.toLowerCase().includes(q)) ||
          (i.user_tags && i.user_tags.some((t) => t.toLowerCase().includes(q))),
      );
    }

    const sorted = [...result];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.ingested_at).getTime() - new Date(b.ingested_at).getTime());
        break;
      case "title-az":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime());
        break;
    }

    return sorted;
  }, [items, groups, selected, contentTypeFilter, searchQuery, sort]);

  const visible = processed.slice(0, visibleCount);
  const hasMore = visibleCount < processed.length;

  const hasActiveFilters = contentTypeFilter !== "all" || sort !== "newest" || searchQuery.trim() !== "";

  function clearFilters() {
    setContentTypeFilter("all");
    setSort("newest");
    setSearchQuery("");
    setVisibleCount(PAGE_SIZE);
  }

  // Reset pagination when filters change
  function handleSourceChange(source: string) {
    setSelected(source);
    setVisibleCount(PAGE_SIZE);
    setSourceOpen(false);
  }

  const toggleItem = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const visibleIds = visible.map((i) => i.id);
    const allChecked = visibleIds.every((id) => checkedIds.has(id));
    if (allChecked) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.add(id);
        return next;
      });
    }
  }, [visible, checkedIds]);

  async function handleBulkDelete() {
    if (checkedIds.size === 0) return;
    setDeleting(true);
    try {
      await fetch("/api/context/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checkedIds] }),
      });
      setCheckedIds(new Set());
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const allVisibleChecked = visible.length > 0 && visible.every((i) => checkedIds.has(i.id));
  const someChecked = checkedIds.size > 0;

  return (
    <div data-testid="context-library" className="flex h-full min-h-0 gap-0 overflow-hidden flex-col md:flex-row">
      {/* Left: source folders */}
      <aside
        data-testid="context-source-sidebar"
        className={cn(
          "shrink-0 border-r bg-card flex flex-col",
          "md:w-52 md:flex",
          sourceOpen ? "flex" : "hidden md:flex"
        )}
      >
        <div className="p-3 border-b">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <button
            data-testid="source-filter-all"
            onClick={() => handleSourceChange("all")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              selected === "all"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">All Items</span>
            <span className="text-xs opacity-60">{items.length}</span>
          </button>

          {sources.map((key) => {
            const meta = SOURCE_META[key] ?? { label: key, icon: FileText, color: "text-muted-foreground" };
            const Icon = meta.icon;
            const count = groups[key].length;
            return (
              <button
                key={key}
                data-testid={`source-filter-${key}`}
                onClick={() => handleSourceChange(key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  selected === key
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
                <span className="flex-1 text-left">{meta.label}</span>
                <span className="text-xs opacity-60">{count}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Right: item list */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <div className="flex flex-col gap-2 px-4 sm:px-5 py-3 border-b bg-card">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSourceOpen(!sourceOpen)}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:hidden"
                aria-label="Toggle sources"
              >
                <Filter className="h-4 w-4" />
              </button>
              <Checkbox
                data-testid="context-select-all"
                checked={allVisibleChecked}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
              <p className="text-sm font-medium">
                {selected === "all"
                  ? "All Items"
                  : (SOURCE_META[selected]?.label ?? selected)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span data-testid="context-item-count" className="text-xs text-muted-foreground">
                {processed.length} item{processed.length !== 1 ? "s" : ""}
              </span>
              <ExportDropdown
                itemIds={checkedIds.size > 0 ? [...checkedIds] : undefined}
                query={checkedIds.size === 0 && searchQuery.trim() ? searchQuery.trim() : undefined}
              />
            </div>
          </div>

          {/* Saved searches */}
          <SavedSearches
            currentQuery={searchQuery}
            currentFilters={contentTypeFilter !== "all" ? { content_type: contentTypeFilter } : {}}
            onApply={(query, filters) => {
              setSearchQuery(query);
              if (filters.content_type) {
                setContentTypeFilter(filters.content_type);
              }
              if (filters.source_type) {
                const normalized = filters.source_type === "gdrive" ? "google-drive" : filters.source_type === "github-app" ? "github" : filters.source_type;
                setSelected(normalized);
              }
              setVisibleCount(PAGE_SIZE);
            }}
          />

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                data-testid="context-search-input"
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
                className="h-8 w-[180px] rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setVisibleCount(PAGE_SIZE); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Select
              value={contentTypeFilter}
              onValueChange={(v) => { setContentTypeFilter(v); setVisibleCount(PAGE_SIZE); }}
            >
              <SelectTrigger data-testid="content-type-filter" className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {contentTypes.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {ct.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(v) => { setSort(v as SortOption); setVisibleCount(PAGE_SIZE); }}
            >
              <SelectTrigger data-testid="sort-filter" className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="title-az">Title A–Z</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {searchQuery.trim() && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  Search: {searchQuery}
                  <button
                    onClick={() => { setSearchQuery(""); setVisibleCount(PAGE_SIZE); }}
                    className="ml-0.5 hover:text-foreground"
                    aria-label="Remove search filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {contentTypeFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  {contentTypeFilter.replace(/_/g, " ")}
                  <button
                    onClick={() => { setContentTypeFilter("all"); setVisibleCount(PAGE_SIZE); }}
                    className="ml-0.5 hover:text-foreground"
                    aria-label="Remove content type filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {sort !== "newest" && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  {sort === "oldest" ? "Oldest first" : "Title A–Z"}
                  <button
                    onClick={() => { setSort("newest"); setVisibleCount(PAGE_SIZE); }}
                    className="ml-0.5 hover:text-foreground"
                    aria-label="Remove sort"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nothing here yet</p>
            </div>
          ) : (
            <div data-testid="context-items-list" className="divide-y">
              {visible.map((item) => {
                const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                const ContentIcon = CONTENT_TYPE_ICON[item.content_type] ?? FileText;
                const isChecked = checkedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    data-testid={`context-item-${item.id}`}
                    className={cn(
                      "flex items-start gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 hover:bg-accent/30 transition-colors",
                      isChecked && "bg-primary/5",
                    )}
                  >
                    <Checkbox
                      data-testid={`context-item-checkbox-${item.id}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="mt-0.5 shrink-0"
                      aria-label={`Select ${item.title}`}
                    />
                    <Link
                      href={`/context/${item.id}`}
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <ContentIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate hover:underline">{item.title}</p>
                        {item.description_short && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description_short}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {item.content_type.replace(/_/g, " ")} · {new Date(item.ingested_at).toLocaleDateString()}
                          </p>
                          {item.user_tags && item.user_tags.length > 0 && item.user_tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0 mt-1", status.className)} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center py-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Load more ({processed.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>

        {/* Floating action bar */}
        {someChecked && (
          <div data-testid="bulk-action-bar" className="sticky bottom-0 border-t bg-card px-3 sm:px-5 py-2.5 flex items-center justify-between">
            <span data-testid="bulk-selection-count" className="text-sm text-muted-foreground">
              {checkedIds.size} item{checkedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <ExportDropdown itemIds={[...checkedIds]} label="Export selected" />
              <Button
                data-testid="bulk-cancel-button"
                variant="ghost"
                size="sm"
                onClick={() => setCheckedIds(new Set())}
              >
                Cancel
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button data-testid="bulk-delete-button" variant="destructive" size="sm" disabled={deleting}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {checkedIds.size} item{checkedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. The selected context items will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
