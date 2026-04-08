"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  FileText,
  HardDrive,
  Github,
  Upload,
  Hash,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
  FileSpreadsheet,
  FileVideo,
  MessageSquare,
  GitBranch,
  Mic,
  Mail,
  Brain,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LibraryFilters } from "@/components/library-filters";
import { LibraryContextMenu } from "@/components/library-context-menu";
import { ContextInfoPanel } from "@/components/context-info-panel";

/* ---------- Types ---------- */
export interface ContextItem {
  id: string;
  title: string;
  description_short: string | null;
  source_type: string;
  content_type: string;
  status: string;
  ingested_at: string;
  user_tags?: string[] | null;
}

interface LibraryShellProps {
  items: ContextItem[];
  initialSearch: string;
  initialSource: string;
  initialFolder: string;
  initialType: string;
  initialTags: string;
  initialStatus: string;
  initialFrom: string;
  initialTo: string;
}

/* ---------- Source metadata ---------- */
export const SOURCE_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  "google-drive": {
    label: "Google Drive",
    icon: HardDrive,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  gdrive: {
    label: "Google Drive",
    icon: HardDrive,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  github: {
    label: "GitHub",
    icon: Github,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
  },
  "github-app": {
    label: "GitHub",
    icon: Github,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
  },
  slack: {
    label: "Slack",
    icon: Hash,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  granola: {
    label: "Granola",
    icon: Mic,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  gmail: {
    label: "Gmail",
    icon: Mail,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  linear: {
    label: "Linear",
    icon: GitBranch,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  upload: {
    label: "Uploads",
    icon: Upload,
    color: "text-green-600",
    bg: "bg-green-500/10",
  },
  "layers-ai": {
    label: "AI Generated",
    icon: Brain,
    color: "text-primary",
    bg: "bg-primary/10",
  },
};

export const CONTENT_TYPE_ICON: Record<string, React.ElementType> = {
  meeting_transcript: Mic,
  document: FileText,
  issue: GitBranch,
  message: MessageSquare,
  spreadsheet: FileSpreadsheet,
  video: FileVideo,
};

const STATUS_CONFIG = {
  ready: {
    label: "Ready",
    icon: CheckCircle,
    className: "text-green-600",
    badgeCls: "bg-green-500/10 text-green-700 border-green-200",
  },
  processing: {
    label: "Processing",
    icon: Loader,
    className: "text-blue-500 animate-spin",
    badgeCls: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "text-muted-foreground",
    badgeCls: "bg-muted text-muted-foreground border-muted",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className: "text-destructive",
    badgeCls: "bg-red-500/10 text-red-700 border-red-200",
  },
} as const;

function normalizeSource(source: string) {
  if (source === "gdrive") return "google-drive";
  if (source === "github-app") return "github";
  return source;
}

function relativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* Derive "folders" from content_type within a source */
function deriveFolders(
  items: ContextItem[],
  source: string,
): { folder: string; count: number }[] {
  const sourceItems =
    source === ""
      ? items
      : items.filter((i) => normalizeSource(i.source_type) === source);
  const counts: Record<string, number> = {};
  for (const item of sourceItems) {
    const ct = item.content_type || "other";
    counts[ct] = (counts[ct] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count);
}

/* ========== Mobile Column State ========== */
type MobileColumn = "sources" | "folders" | "files";

/* ========== Main Component ========== */
export function LibraryShell({
  items,
  initialSearch,
  initialSource,
  initialFolder,
  initialType,
  initialTags,
  initialStatus,
  initialFrom,
  initialTo,
}: LibraryShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        await fetch("/api/ingest/upload", { method: "POST", body: form });
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  };

  const [selectedSource, setSelectedSource] = useState(initialSource);
  const [selectedFolder, setSelectedFolder] = useState(initialFolder);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [infoPanelItem, setInfoPanelItem] = useState<ContextItem | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  // Mobile column navigation
  const [mobileColumn, setMobileColumn] = useState<MobileColumn>(
    initialFolder ? "files" : initialSource ? "folders" : "sources",
  );

  // Filter state
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [tagsFilter, setTagsFilter] = useState(initialTags);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);

  // Update URL when filters change
  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams(sp.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      }
      const qs = newParams.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  const handleSourceSelect = useCallback(
    (source: string) => {
      setSelectedSource(source);
      setSelectedFolder("");
      setMobileColumn("folders");
      updateUrl({ source, folder: "" });
    },
    [updateUrl],
  );

  const handleFolderSelect = useCallback(
    (folder: string) => {
      setSelectedFolder(folder);
      setMobileColumn("files");
      updateUrl({ folder });
    },
    [updateUrl],
  );

  const handleMobileBack = useCallback(() => {
    if (mobileColumn === "files") {
      setMobileColumn("folders");
    } else if (mobileColumn === "folders") {
      setSelectedSource("");
      setSelectedFolder("");
      setMobileColumn("sources");
      updateUrl({ source: "", folder: "" });
    }
  }, [mobileColumn, updateUrl]);

  // Derive sources from items
  const sourceGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of items) {
      const key = normalizeSource(item.source_type);
      groups[key] = (groups[key] || 0) + 1;
    }
    return Object.entries(groups)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // Derive folders for selected source
  const folders = useMemo(
    () => deriveFolders(items, selectedSource),
    [items, selectedSource],
  );

  // All unique tags for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of items) {
      if (item.user_tags) {
        for (const tag of item.user_tags) tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedSource) {
      result = result.filter(
        (i) => normalizeSource(i.source_type) === selectedSource,
      );
    }

    if (selectedFolder) {
      result = result.filter((i) => i.content_type === selectedFolder);
    }

    if (typeFilter) {
      result = result.filter((i) => i.content_type === typeFilter);
    }

    if (statusFilter) {
      result = result.filter((i) => i.status === statusFilter);
    }

    if (tagsFilter) {
      const filterTags = tagsFilter.split(",").map((t) => t.trim().toLowerCase());
      result = result.filter(
        (i) =>
          i.user_tags &&
          filterTags.every((ft) =>
            i.user_tags!.some((ut) => ut.toLowerCase().includes(ft)),
          ),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((i) => new Date(i.ingested_at) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((i) => new Date(i.ingested_at) <= to);
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

    return result.sort(
      (a, b) =>
        new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime(),
    );
  }, [
    items,
    selectedSource,
    selectedFolder,
    typeFilter,
    statusFilter,
    tagsFilter,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  const activeFilterCount =
    (typeFilter ? 1 : 0) +
    (tagsFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setSelectedSource("");
    setSelectedFolder("");
    setSearchQuery("");
    setTypeFilter("");
    setTagsFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    updateUrl({
      source: "",
      folder: "",
      search: "",
      type: "",
      tags: "",
      status: "",
      from: "",
      to: "",
    });
  }, [updateUrl]);

  const handleOpenInfo = useCallback((item: ContextItem) => {
    setInfoPanelItem(item);
    setInfoPanelOpen(true);
  }, []);

  // Context menu: open info panel to add tags
  const handleAddTags = useCallback((item: ContextItem) => {
    setInfoPanelItem(item);
    setInfoPanelOpen(true);
  }, []);

  // Context menu: open info panel to show version history
  const handleViewHistory = useCallback((item: ContextItem) => {
    setInfoPanelItem(item);
    setInfoPanelOpen(true);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 sm:p-6 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold mb-0.5">
              Context Library
            </h1>
            <p className="text-muted-foreground text-sm">
              All documents, transcripts, and files available to your agents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={uploading}
              onClick={() => uploadInputRef.current?.click()}
            >
              {uploading ? <Loader className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              <span className="hidden sm:inline">{uploading ? "Uploading..." : "Upload"}</span>
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv"
              multiple
              className="hidden"
              onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ""; }}
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/context/upload-meeting">
                <Mic className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Upload Meeting</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Breadcrumb trail */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {selectedSource ? (
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSourceSelect("");
                  }}
                >
                  All Sources
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>All Sources</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {selectedSource && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {selectedFolder ? (
                    <BreadcrumbLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleFolderSelect("");
                      }}
                    >
                      {SOURCE_META[selectedSource]?.label ?? selectedSource}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>
                      {SOURCE_META[selectedSource]?.label ?? selectedSource}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {selectedFolder && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {selectedFolder.replace(/_/g, " ")}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Search + filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                updateUrl({ search: e.target.value });
              }}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  updateUrl({ search: "" });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <LibraryFilters
            items={items}
            allTags={allTags}
            typeFilter={typeFilter}
            tagsFilter={tagsFilter}
            statusFilter={statusFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            activeCount={activeFilterCount}
            onTypeChange={(v) => {
              setTypeFilter(v);
              updateUrl({ type: v });
            }}
            onTagsChange={(v) => {
              setTagsFilter(v);
              updateUrl({ tags: v });
            }}
            onStatusChange={(v) => {
              setStatusFilter(v);
              updateUrl({ status: v });
            }}
            onDateFromChange={(v) => {
              setDateFrom(v);
              updateUrl({ from: v });
            }}
            onDateToChange={(v) => {
              setDateTo(v);
              updateUrl({ to: v });
            }}
            onClearAll={clearAllFilters}
          />

          <span className="text-xs text-muted-foreground ml-auto">
            {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Mobile back navigation */}
      <div className="flex items-center gap-2 px-4 sm:px-6 pt-2 sm:hidden">
        {mobileColumn !== "sources" && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={handleMobileBack}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {mobileColumn === "sources" && "Sources"}
          {mobileColumn === "folders" &&
            ((SOURCE_META[selectedSource]?.label ?? selectedSource) || "Content Types")}
          {mobileColumn === "files" && `${filteredItems.length} files`}
        </span>
      </div>

      {/* Three-column Finder layout - Desktop: side by side, Mobile: stacked */}
      <div className="flex-1 flex min-h-0 p-4 sm:p-6 pt-3 gap-0">
        {/* Column 1: Sources */}
        <div
          className={cn(
            "sm:w-48 sm:shrink-0 sm:block border sm:rounded-l-lg bg-card overflow-hidden",
            mobileColumn === "sources" ? "flex-1 rounded-lg sm:rounded-none sm:flex-none" : "hidden",
          )}
        >
          <ScrollArea className="h-full">
            <div className="p-2 border-b">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Sources
              </span>
            </div>
            <button
              onClick={() => {
                handleSourceSelect("");
                setMobileColumn("folders");
              }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2.5 sm:py-2 text-sm transition-colors",
                selectedSource === ""
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent text-foreground",
              )}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">All Sources</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {items.length}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 sm:hidden" />
            </button>
            {sourceGroups.map(({ key, count }) => {
              const meta = SOURCE_META[key] ?? {
                label: key,
                icon: FileText,
                color: "text-muted-foreground",
                bg: "bg-muted",
              };
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => handleSourceSelect(key)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2.5 sm:py-2 text-sm transition-colors",
                    selectedSource === key
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selectedSource === key ? "text-primary" : meta.color,
                    )}
                  />
                  <span className="truncate">{meta.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {count}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 sm:hidden" />
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Column 2: Folders / Content Types */}
        <div
          className={cn(
            "sm:w-48 sm:shrink-0 sm:block border-y border-r sm:border-l-0 bg-card overflow-hidden",
            mobileColumn === "folders" ? "flex-1 rounded-lg sm:rounded-none sm:flex-none border sm:border-l-0" : "hidden",
          )}
        >
          <ScrollArea className="h-full">
            <div className="p-2 border-b">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {selectedSource
                  ? `${SOURCE_META[selectedSource]?.label ?? selectedSource} Types`
                  : "Content Types"}
              </span>
            </div>
            <button
              onClick={() => handleFolderSelect("")}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2.5 sm:py-2 text-sm transition-colors",
                selectedFolder === ""
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent text-foreground",
              )}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">All</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedSource
                  ? items.filter(
                      (i) => normalizeSource(i.source_type) === selectedSource,
                    ).length
                  : items.length}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 sm:hidden" />
            </button>
            {folders.map(({ folder, count }) => {
              const Icon = CONTENT_TYPE_ICON[folder] ?? FileText;
              return (
                <button
                  key={folder}
                  onClick={() => handleFolderSelect(folder)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2.5 sm:py-2 text-sm transition-colors",
                    selectedFolder === folder
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate capitalize">
                    {folder.replace(/_/g, " ")}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {count}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 sm:hidden" />
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Column 3: Files */}
        <div
          className={cn(
            "sm:flex-1 sm:block border-y border-r sm:rounded-r-lg bg-card overflow-hidden",
            mobileColumn === "files" ? "flex-1 rounded-lg sm:rounded-none sm:rounded-r-lg border sm:border-l-0" : "hidden",
          )}
        >
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Files
            </span>
            <span className="text-[11px] text-muted-foreground">
              {filteredItems.length} items
            </span>
          </div>

          <ScrollArea className="h-[calc(100%-2.5rem)]">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium text-foreground">
                  No items found
                </p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  Try adjusting your filters or navigate to a different source.
                </p>
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={clearAllFilters}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredItems.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    onSelect={handleOpenInfo}
                    onAddTags={handleAddTags}
                    onViewHistory={handleViewHistory}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Info Panel */}
      <ContextInfoPanel
        item={infoPanelItem}
        open={infoPanelOpen}
        onOpenChange={setInfoPanelOpen}
      />
    </div>
  );
}

/* ---------- File Row ---------- */
function FileRow({
  item,
  onSelect,
  onAddTags,
  onViewHistory,
}: {
  item: ContextItem;
  onSelect: (item: ContextItem) => void;
  onAddTags?: (item: ContextItem) => void;
  onViewHistory?: (item: ContextItem) => void;
}) {
  const sourceMeta = SOURCE_META[normalizeSource(item.source_type)] ?? {
    label: item.source_type,
    icon: FileText,
    color: "text-muted-foreground",
    bg: "bg-muted",
  };
  const SourceIcon = sourceMeta.icon;
  const ContentIcon = CONTENT_TYPE_ICON[item.content_type] ?? FileText;
  const status =
    STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <LibraryContextMenu
      item={item}
      onAddTags={onAddTags}
      onViewHistory={onViewHistory}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/40 transition-colors group"
        onClick={() => onSelect(item)}
      >
        <div
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md shrink-0",
            sourceMeta.bg,
          )}
        >
          <SourceIcon className={cn("h-4 w-4", sourceMeta.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {item.title}
          </p>
          {item.description_short && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {item.description_short}
            </p>
          )}
          {item.user_tags && item.user_tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {item.user_tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground"
                >
                  {tag}
                </Badge>
              ))}
              {item.user_tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{item.user_tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <ContentIcon className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground capitalize">
            {item.content_type.replace(/_/g, " ")}
          </span>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "hidden sm:inline-flex text-[10px] font-medium border shrink-0",
            status.badgeCls,
          )}
        >
          <StatusIcon className={cn("h-3 w-3 mr-1", status.className)} />
          {status.label}
        </Badge>

        <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
          {relativeDate(item.ingested_at)}
        </span>

        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      </div>
    </LibraryContextMenu>
  );
}
