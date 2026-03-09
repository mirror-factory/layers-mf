"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContextItem {
  id: string;
  title: string;
  description_short: string | null;
  source_type: string;
  content_type: string;
  status: string;
  ingested_at: string;
}

interface Props {
  items: ContextItem[];
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

export function ContextLibrary({ items }: Props) {
  const [selected, setSelected] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sourceOpen, setSourceOpen] = useState(false);

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

  // Filter → sort → paginate
  const processed = useMemo(() => {
    let result = selected === "all" ? items : (groups[selected] ?? []);

    if (contentTypeFilter !== "all") {
      result = result.filter((i) => i.content_type === contentTypeFilter);
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
  }, [items, groups, selected, contentTypeFilter, sort]);

  const visible = processed.slice(0, visibleCount);
  const hasMore = visibleCount < processed.length;

  const hasActiveFilters = contentTypeFilter !== "all" || sort !== "newest";

  function clearFilters() {
    setContentTypeFilter("all");
    setSort("newest");
    setVisibleCount(PAGE_SIZE);
  }

  // Reset pagination when filters change
  function handleSourceChange(source: string) {
    setSelected(source);
    setVisibleCount(PAGE_SIZE);
    setSourceOpen(false);
  }

  return (
    <div className="flex h-full min-h-0 gap-0 overflow-hidden flex-col md:flex-row">
      {/* Left: source folders */}
      <aside
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
              <p className="text-sm font-medium">
                {selected === "all"
                  ? "All Items"
                  : (SOURCE_META[selected]?.label ?? selected)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {processed.length} item{processed.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={contentTypeFilter}
              onValueChange={(v) => { setContentTypeFilter(v); setVisibleCount(PAGE_SIZE); }}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
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
              <SelectTrigger className="h-8 w-[130px] text-xs">
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
            <div className="divide-y">
              {visible.map((item) => {
                const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                const ContentIcon = CONTENT_TYPE_ICON[item.content_type] ?? FileText;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/30 transition-colors"
                  >
                    <ContentIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.description_short && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {item.description_short}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.content_type.replace(/_/g, " ")} · {new Date(item.ingested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusIcon className={cn("h-3.5 w-3.5 shrink-0 mt-1", status.className)} />
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
      </div>
    </div>
  );
}
