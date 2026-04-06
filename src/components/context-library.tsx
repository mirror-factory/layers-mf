"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
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
  List,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
  Loader2,
  FileSpreadsheet,
  FileVideo,
  MessageSquare,
  GitBranch,
  Mic,
  Mail,
  Filter,
  X,
  Trash2,
  Search,
  Brain,
  FolderOpen,
  Plus,
  ArrowUpFromLine,
  Download,
  MoreVertical,
  Users,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Tag,
  PanelLeft,
} from "lucide-react";
import { CollectionsSidebar, type SidebarSection } from "@/components/collections-sidebar";
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
import { ContextInfoPanel } from "@/components/context-info-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SavedSearches } from "@/components/saved-searches";
import { ExportDropdown } from "@/components/export-dropdown";
import { trackInteraction } from "@/lib/tracking";

interface ContextItem {
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
}

interface Props {
  items: ContextItem[];
  initialSearch?: string;
}

const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  "google-drive": { label: "Google Drive", icon: HardDrive, color: "text-blue-500",    bg: "bg-blue-500/10" },
  gdrive:         { label: "Google Drive", icon: HardDrive, color: "text-blue-500",    bg: "bg-blue-500/10" },
  github:         { label: "GitHub",       icon: Github,    color: "text-slate-600",   bg: "bg-slate-500/10" },
  "github-app":   { label: "GitHub",       icon: Github,    color: "text-slate-600",   bg: "bg-slate-500/10" },
  slack:          { label: "Slack",        icon: Hash,      color: "text-purple-500",  bg: "bg-purple-500/10" },
  granola:        { label: "Granola",      icon: Mic,       color: "text-orange-500",  bg: "bg-orange-500/10" },
  gmail:          { label: "Gmail",        icon: Mail,      color: "text-red-500",     bg: "bg-red-500/10" },
  linear:         { label: "Linear",       icon: GitBranch, color: "text-indigo-500",  bg: "bg-indigo-500/10" },
  notion:         { label: "Notion",       icon: FileText,  color: "text-slate-700",   bg: "bg-slate-500/10" },
  upload:         { label: "Uploads",      icon: Upload,    color: "text-green-600",   bg: "bg-green-500/10" },
  "layers-ai":    { label: "Granger AI",    icon: Brain,     color: "text-primary",     bg: "bg-primary/10" },
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
  ready:      { label: "Ready",      icon: CheckCircle, className: "text-green-600",  badgeCls: "bg-green-500/10 text-green-700 border-green-200" },
  processing: { label: "Processing", icon: Loader,      className: "text-blue-500 animate-spin", badgeCls: "bg-blue-500/10 text-blue-700 border-blue-200" },
  pending:    { label: "Pending",    icon: Clock,       className: "text-muted-foreground", badgeCls: "bg-muted text-muted-foreground border-muted" },
  error:      { label: "Error",      icon: AlertCircle, className: "text-destructive", badgeCls: "bg-red-500/10 text-red-700 border-red-200" },
} as const;

type SortOption = "newest" | "oldest" | "title-az";
type ViewMode = "grid" | "list";

const PAGE_SIZE = 24;

const ACCEPTED = ".pdf,.docx,.txt,.md";

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

/* ---------- Inline Drop Zone ---------- */
function InlineDropZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/ingest/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok && res.status !== 207) {
        setMessage({ text: data.error ?? "Upload failed", ok: false });
      } else if (data.status === "error") {
        setMessage({ text: "File saved but processing failed. Will retry.", ok: false });
      } else {
        setMessage({ text: `"${file.name}" uploaded successfully.`, ok: true });
        router.refresh();
      }
    } catch {
      setMessage({ text: "Network error. Please try again.", ok: false });
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  return (
    <div
      data-testid="upload-dropzone"
      className={cn(
        "relative flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-all cursor-pointer group",
        dragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-accent/30",
        uploading && "pointer-events-none opacity-60",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <div className={cn(
        "flex items-center justify-center h-10 w-10 rounded-lg shrink-0 transition-colors",
        dragging ? "bg-primary/10" : "bg-muted",
      )}>
        {uploading
          ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          : <ArrowUpFromLine className={cn("h-5 w-5 transition-colors", dragging ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {uploading ? "Processing..." : "Drop files here or click to upload"}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, TXT, or Markdown &mdash; max 10 MB
        </p>
      </div>
      {message && (
        <p className={cn("text-xs shrink-0", message.ok ? "text-green-600" : "text-destructive")}>
          {message.text}
        </p>
      )}
      <input
        ref={inputRef}
        data-testid="upload-file-input"
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/* ---------- Source Filter Pills ---------- */
function SourcePills({
  sources,
  groups,
  totalCount,
  selected,
  onSelect,
  sharedCount,
}: {
  sources: string[];
  groups: Record<string, ContextItem[]>;
  totalCount: number;
  selected: string;
  onSelect: (s: string) => void;
  sharedCount?: number;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" data-testid="source-pills">
      <button
        data-testid="source-filter-all"
        onClick={() => onSelect("all")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
          selected === "all"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        All
        <span className="opacity-70">{totalCount}</span>
      </button>
      {/* Shared with me pill */}
      <button
        data-testid="source-filter-shared"
        onClick={() => onSelect("shared-with-me")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
          selected === "shared-with-me"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Users className={cn("h-3.5 w-3.5", selected === "shared-with-me" ? "" : "text-violet-500")} />
        Shared with me
        {sharedCount !== undefined && <span className="opacity-70">{sharedCount}</span>}
      </button>
      {sources.map((key) => {
        const meta = SOURCE_META[key] ?? { label: key, icon: FileText, color: "text-muted-foreground", bg: "bg-muted" };
        const Icon = meta.icon;
        const count = groups[key]?.length ?? 0;
        return (
          <button
            key={key}
            data-testid={`source-filter-${key}`}
            onClick={() => onSelect(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              selected === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", selected === key ? "" : meta.color)} />
            {meta.label}
            <span className="opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Item Actions ---------- */
function ItemActions({
  item,
  onDelete,
  onPin,
  onArchive,
  deleting,
  className,
}: {
  item: ContextItem;
  onDelete: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  onArchive?: (id: string, archived: boolean) => void;
  deleting: boolean;
  className?: string;
}) {
  function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    fetch(`/api/context/${item.id}`)
      .then((res) => res.json())
      .then((data) => {
        const content = data.raw_content ?? data.description_long ?? data.description_short ?? "";
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeName = (item.title || "document").replace(/[^a-zA-Z0-9_\- ]/g, "").trim();
        a.download = `${safeName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* Pin toggle */}
      {onPin && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPin(item.id, !item.is_pinned); }}
                className={cn(
                  "inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                  item.is_pinned
                    ? "text-primary hover:text-primary/70 hover:bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
                aria-label={item.is_pinned ? "Unpin" : "Pin"}
              >
                {item.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{item.is_pinned ? "Unpin" : "Pin"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleDownload}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label={`Download ${item.title}`}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Download</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Archive toggle */}
      {onArchive && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(item.id, !item.is_archived); }}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label={item.is_archived ? "Unarchive" : "Archive"}
              >
                {item.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{item.is_archived ? "Unarchive" : "Archive"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <AlertDialog>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{item.title}&rdquo; will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(item.id)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Grid Card ---------- */
function ContextGridCard({ item, isChecked, onToggle, onDelete, onPin, onArchive, onTagClick, deletingId, onInfoClick }: { item: ContextItem; isChecked: boolean; onToggle: () => void; onDelete: (id: string) => void; onPin?: (id: string, pinned: boolean) => void; onArchive?: (id: string, archived: boolean) => void; onTagClick?: (tag: string) => void; deletingId: string | null; onInfoClick?: (item: ContextItem) => void }) {
  const sourceMeta = SOURCE_META[normalizeSource(item.source_type)] ?? { label: item.source_type, icon: FileText, color: "text-muted-foreground", bg: "bg-muted" };
  const SourceIcon = sourceMeta.icon;
  const ContentIcon = CONTENT_TYPE_ICON[item.content_type] ?? FileText;
  const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <div
      data-testid={`context-item-${item.id}`}
      className={cn(
        "group relative rounded-lg border bg-card transition-all hover:shadow-md hover:border-foreground/15",
        isChecked && "ring-2 ring-primary border-primary/30",
      )}
    >
      {/* Pin indicator */}
      {item.is_pinned && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <Pin className="h-3.5 w-3.5 text-primary fill-primary/20" />
        </div>
      )}

      {/* Checkbox overlay */}
      <div className={cn(
        "absolute top-2.5 left-2.5 z-10 transition-opacity",
        isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}>
        <Checkbox
          data-testid={`context-item-checkbox-${item.id}`}
          checked={isChecked}
          onCheckedChange={onToggle}
          aria-label={`Select ${item.title}`}
        />
      </div>

      <div
        className="flex flex-col h-full p-4 cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          trackInteraction({
            type: "click",
            resourceType: "context_item",
            resourceId: item.id,
            sourceType: item.source_type,
            contentType: item.content_type,
            metadata: { fromPage: "/context" },
          });
          onInfoClick?.(item);
        }}
      >
        {/* Icon + source badge header */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn("flex items-center justify-center h-10 w-10 rounded-lg", sourceMeta.bg)}>
            <SourceIcon className={cn("h-5 w-5", sourceMeta.color)} />
          </div>
          <div className="flex items-center gap-1">
            <ItemActions
              item={item}
              onDelete={onDelete}
              onPin={onPin}
              onArchive={onArchive}
              deleting={deletingId === item.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <Badge variant="outline" className={cn("text-[10px] font-medium border", status.badgeCls)}>
              <StatusIcon className={cn("h-3 w-3 mr-1", status.className)} />
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {/* Description */}
        {item.description_short && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {item.description_short}
          </p>
        )}

        {/* Shared by badge */}
        {"sharedBy" in item && (item as ContextItem & { sharedBy?: string }).sharedBy && (
          <div className="flex items-center gap-1.5 mb-2">
            <Badge variant="outline" className="text-[10px] font-normal border-violet-200 bg-violet-500/10 text-violet-700">
              <Users className="h-3 w-3 mr-1" />
              Shared by {(item as ContextItem & { sharedBy?: string }).sharedBy}
            </Badge>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-dashed">
          <div className="flex items-center gap-1.5">
            <ContentIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground capitalize">
              {item.content_type.replace(/_/g, " ")}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {relativeDate(item.ingested_at)}
          </span>
        </div>

        {/* Tags */}
        {item.user_tags && item.user_tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {item.user_tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagClick?.(tag); }}
                className="inline-flex items-center gap-0.5 rounded-full bg-primary/5 border border-primary/10 px-1.5 py-0 h-4 text-[10px] font-normal text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Tag className="h-2 w-2" />
                {tag}
              </button>
            ))}
            {item.user_tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{item.user_tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- List Row ---------- */
function ContextListRow({ item, isChecked, onToggle, onDelete, onPin, onArchive, onTagClick, deletingId, onInfoClick }: { item: ContextItem; isChecked: boolean; onToggle: () => void; onDelete: (id: string) => void; onPin?: (id: string, pinned: boolean) => void; onArchive?: (id: string, archived: boolean) => void; onTagClick?: (tag: string) => void; deletingId: string | null; onInfoClick?: (item: ContextItem) => void }) {
  const sourceMeta = SOURCE_META[normalizeSource(item.source_type)] ?? { label: item.source_type, icon: FileText, color: "text-muted-foreground", bg: "bg-muted" };
  const SourceIcon = sourceMeta.icon;
  const ContentIcon = CONTENT_TYPE_ICON[item.content_type] ?? FileText;
  const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <div
      role="listitem"
      data-testid={`context-item-${item.id}`}
      className={cn(
        "group flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-accent/30 transition-colors",
        isChecked && "bg-primary/5",
      )}
    >
      <Checkbox
        data-testid={`context-item-checkbox-${item.id}`}
        checked={isChecked}
        onCheckedChange={onToggle}
        className="shrink-0"
        aria-label={`Select ${item.title}`}
      />
      <div
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => {
          trackInteraction({
            type: "click",
            resourceType: "context_item",
            resourceId: item.id,
            sourceType: item.source_type,
            contentType: item.content_type,
            metadata: { fromPage: "/context" },
          });
          onInfoClick?.(item);
        }}
      >
        {/* Source icon */}
        <div className={cn("flex items-center justify-center h-8 w-8 rounded-md shrink-0", sourceMeta.bg)}>
          <SourceIcon className={cn("h-4 w-4", sourceMeta.color)} />
        </div>

        {/* Title + description + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {item.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary/20 shrink-0" />}
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.title}</p>
          </div>
          {item.description_short && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {item.description_short}
            </p>
          )}
          {item.user_tags && item.user_tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {item.user_tags.slice(0, 3).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagClick?.(tag); }}
                  className="inline-flex items-center gap-0.5 rounded-full bg-primary/5 border border-primary/10 px-1.5 py-0 h-4 text-[10px] font-normal text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Tag className="h-2 w-2" />
                  {tag}
                </button>
              ))}
              {item.user_tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{item.user_tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Content type */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <ContentIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground capitalize whitespace-nowrap">
            {item.content_type.replace(/_/g, " ")}
          </span>
        </div>

        {/* Status badge */}
        <Badge variant="outline" className={cn("hidden sm:inline-flex text-[10px] font-medium border shrink-0", status.badgeCls)}>
          <StatusIcon className={cn("h-3 w-3 mr-1", status.className)} />
          {status.label}
        </Badge>

        {/* Date */}
        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
          {relativeDate(item.ingested_at)}
        </span>

        {/* Mobile status indicator */}
        <StatusIcon className={cn("h-3.5 w-3.5 shrink-0 sm:hidden", status.className)} />
      </div>

      {/* Actions */}
      <ItemActions
        item={item}
        onDelete={onDelete}
        onPin={onPin}
        onArchive={onArchive}
        deleting={deletingId === item.id}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </div>
  );
}

/* ---------- Empty State ---------- */
function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Search className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-sm font-medium text-foreground">No matching items</p>
        <p className="text-xs mt-1 max-w-xs text-center">
          Try adjusting your filters or search query.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear all filters
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="context-empty-state" className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-5">
        <FolderOpen className="h-8 w-8 opacity-40" />
      </div>
      <p className="text-base font-semibold text-foreground mb-1">Your context library is empty</p>
      <p className="text-sm max-w-md text-center mb-6">
        Add documents, meeting transcripts, and other context so your AI agents can reference them during sessions.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full">
        <Link
          href="/integrations"
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 hover:bg-accent/50 hover:border-foreground/15 transition-all text-center"
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Connect integration</span>
          <span className="text-[11px] text-muted-foreground">Linear, Drive, Gmail, Slack</span>
        </Link>
        <Link
          href="/context/upload-meeting"
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 hover:bg-accent/50 hover:border-foreground/15 transition-all text-center"
        >
          <Mic className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Upload meeting</span>
          <span className="text-[11px] text-muted-foreground">Audio or transcript files</span>
        </Link>
        <Link
          href="/context?upload=true"
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 hover:bg-accent/50 hover:border-foreground/15 transition-all text-center"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Upload files</span>
          <span className="text-[11px] text-muted-foreground">PDF, DOCX, TXT, Markdown</span>
        </Link>
      </div>
    </div>
  );
}

/* ========== Main Component ========== */
export function ContextLibrary({ items, initialSearch = "" }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [infoPanelItem, setInfoPanelItem] = useState<typeof items[0] | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [sharedItems, setSharedItems] = useState<(ContextItem & { sharedBy?: string })[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const sharedFetched = useRef(false);

  // Sidebar state
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set(items.filter((i) => i.is_pinned).map((i) => i.id)));
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set(items.filter((i) => i.is_archived).map((i) => i.id)));
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Fetch "shared with me" items when that filter is selected
  useEffect(() => {
    if (selected !== "shared-with-me" || sharedFetched.current) return;
    setSharedLoading(true);
    fetch("/api/sharing?mine=true")
      .then((res) => res.json())
      .then((data) => {
        const mapped = (data.shares ?? [])
          .filter((s: { contentType: string }) => s.contentType === "context_item")
          .map((s: { contentId: string; title: string; sourceType: string | null; itemContentType: string | null; status: string | null; ingestedAt: string | null; descriptionShort: string | null; sharedBy: string }) => ({
            id: s.contentId,
            title: s.title,
            source_type: s.sourceType ?? "shared",
            content_type: s.itemContentType ?? "document",
            status: s.status ?? "ready",
            ingested_at: s.ingestedAt ?? new Date().toISOString(),
            description_short: s.descriptionShort,
            sharedBy: s.sharedBy,
          }));
        setSharedItems(mapped);
        sharedFetched.current = true;
      })
      .catch(() => setSharedItems([]))
      .finally(() => setSharedLoading(false));
  }, [selected]);

  // Debounced search tracking
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      trackInteraction({
        type: "search",
        query: searchQuery.trim(),
        metadata: { resultCount: processed.length, page: "/context" },
      });
    }, 1000);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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

  // Enrich items with live pin/archive state
  const enrichedItems = useMemo(
    () => items.map((item) => ({
      ...item,
      is_pinned: pinnedIds.has(item.id),
      is_archived: archivedIds.has(item.id),
    })),
    [items, pinnedIds, archivedIds],
  );

  // Filter -> sidebar section -> search -> sort -> paginate
  const processed = useMemo(() => {
    let result: ContextItem[] = selected === "shared-with-me"
      ? sharedItems
      : selected === "all"
        ? enrichedItems
        : (enrichedItems.filter((i) => normalizeSource(i.source_type) === selected));

    // Sidebar section filters
    if (typeof sidebarSection === "string") {
      if (sidebarSection === "pinned") {
        result = result.filter((i) => pinnedIds.has(i.id));
      } else if (sidebarSection === "archived") {
        result = result.filter((i) => archivedIds.has(i.id));
      }
      // "all" and "recent" show everything (recent could sort differently)
    } else if (sidebarSection.type === "tag") {
      result = result.filter(
        (i) => i.user_tags && i.user_tags.some((t) => t.toLowerCase() === sidebarSection.name.toLowerCase()),
      );
    } else if (sidebarSection.type === "smart") {
      if (sidebarSection.id === "needs-review") {
        result = result.filter((i) => i.status === "pending" || i.status === "error");
      } else if (sidebarSection.id === "this-week") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        result = result.filter((i) => new Date(i.ingested_at) >= weekAgo);
      } else if (sidebarSection.id === "untagged") {
        result = result.filter((i) => !i.user_tags || i.user_tags.length === 0);
      }
    }

    // Hide archived items from non-archived views
    if (sidebarSection !== "archived") {
      result = result.filter((i) => !archivedIds.has(i.id));
    }

    // Tag filter (from clicking a tag chip)
    if (tagFilter) {
      result = result.filter(
        (i) => i.user_tags && i.user_tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase()),
      );
    }

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

    // Pinned items float to top (within sort order)
    sorted.sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedIds.has(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });

    return sorted;
  }, [enrichedItems, selected, contentTypeFilter, searchQuery, sort, sharedItems, sidebarSection, tagFilter, pinnedIds, archivedIds]);

  const visible = processed.slice(0, visibleCount);
  const hasMore = visibleCount < processed.length;

  const hasActiveFilters = contentTypeFilter !== "all" || sort !== "newest" || searchQuery.trim() !== "" || selected !== "all" || tagFilter !== null;

  function clearFilters() {
    setContentTypeFilter("all");
    setSort("newest");
    setSearchQuery("");
    setSelected("all");
    setTagFilter(null);
    setSidebarSection("all");
    setVisibleCount(PAGE_SIZE);
  }

  const handlePin = useCallback(async (id: string, pinned: boolean) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (pinned) next.add(id); else next.delete(id);
      return next;
    });
    try {
      await fetch(`/api/context/${id}/pin`, { method: pinned ? "POST" : "DELETE" });
    } catch {
      setPinnedIds((prev) => {
        const next = new Set(prev);
        if (pinned) next.delete(id); else next.add(id);
        return next;
      });
    }
  }, []);

  const handleArchive = useCallback(async (id: string, archived: boolean) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (archived) next.add(id); else next.delete(id);
      return next;
    });
    try {
      await fetch(`/api/context/${id}/archive`, { method: archived ? "POST" : "DELETE" });
    } catch {
      setArchivedIds((prev) => {
        const next = new Set(prev);
        if (archived) next.delete(id); else next.add(id);
        return next;
      });
    }
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setTagFilter(tag);
    setSidebarSection({ type: "tag", name: tag });
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleSidebarSelect = useCallback((section: SidebarSection) => {
    setSidebarSection(section);
    setVisibleCount(PAGE_SIZE);
    if (typeof section === "string") {
      setTagFilter(null);
    } else if (section.type === "tag") {
      setTagFilter(section.name);
    } else {
      setTagFilter(null);
    }
  }, []);

  function handleSourceChange(source: string) {
    setSelected(source);
    setVisibleCount(PAGE_SIZE);
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

  const handleDeleteItem = useCallback(async (id: string) => {
    setDeletingItemId(id);
    try {
      const res = await fetch(`/api/context/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeletingItemId(null);
    }
  }, [router]);

  const allVisibleChecked = visible.length > 0 && visible.every((i) => checkedIds.has(i.id));
  const someChecked = checkedIds.size > 0;

  // Empty library state
  if (items.length === 0) {
    return <EmptyState hasFilters={false} onClear={clearFilters} />;
  }

  return (
    <div data-testid="context-library" className="flex h-full min-h-0">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed bottom-4 left-4 z-30 h-10 w-10 rounded-full bg-card border shadow-lg"
        onClick={() => setSidebarMobileOpen(!sidebarMobileOpen)}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      {/* Sidebar — hidden on mobile unless toggled */}
      <div className={cn(
        "hidden md:flex shrink-0",
        sidebarMobileOpen && "!flex fixed inset-y-0 left-0 z-40 bg-card shadow-xl",
      )}>
        <CollectionsSidebar
          active={sidebarSection}
          onSelect={(section) => {
            handleSidebarSelect(section);
            setSidebarMobileOpen(false);
          }}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>

      {/* Mobile overlay */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
      {/* Drop zone */}
      <div className="px-1 pb-4">
        <InlineDropZone />
      </div>

      {/* Source filter pills */}
      <div className="px-1 pb-3">
        <SourcePills
          sources={sources}
          groups={groups}
          totalCount={items.length}
          selected={selected}
          onSelect={handleSourceChange}
          sharedCount={sharedFetched.current ? sharedItems.length : undefined}
        />
      </div>

      {/* Toolbar: search, filters, view toggle */}
      <div className="flex flex-col gap-2 px-1 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              data-testid="context-search-input"
              type="text"
              aria-label="Search context library"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
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

          {/* Content type filter */}
          <Select
            value={contentTypeFilter}
            onValueChange={(v) => { setContentTypeFilter(v); setVisibleCount(PAGE_SIZE); }}
          >
            <SelectTrigger data-testid="content-type-filter" className="h-8 w-[140px] text-xs" aria-label="Filter by content type">
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

          {/* Sort */}
          <Select
            value={sort}
            onValueChange={(v) => { setSort(v as SortOption); setVisibleCount(PAGE_SIZE); }}
          >
            <SelectTrigger data-testid="sort-filter" className="h-8 w-[120px] text-xs" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title-az">Title A-Z</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center rounded-md border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-testid="view-grid"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "inline-flex items-center justify-center h-8 w-8 rounded-l-md transition-colors",
                      viewMode === "grid"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    aria-label="Grid view"
                    aria-pressed={viewMode === "grid"}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-testid="view-list"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "inline-flex items-center justify-center h-8 w-8 rounded-r-md transition-colors",
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    aria-label="List view"
                    aria-pressed={viewMode === "list"}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>List view</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* Item count + actions */}
          <div className="flex items-center gap-2 ml-auto">
            <span data-testid="context-item-count" className="text-xs text-muted-foreground whitespace-nowrap">
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
            if (filters.content_type) setContentTypeFilter(filters.content_type);
            if (filters.source_type) {
              const normalized = filters.source_type === "gdrive" ? "google-drive" : filters.source_type === "github-app" ? "github" : filters.source_type;
              setSelected(normalized);
            }
            setVisibleCount(PAGE_SIZE);
          }}
        />

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {selected !== "all" && (
              <Badge variant="secondary" className="gap-1 text-xs font-normal">
                Source: {SOURCE_META[selected]?.label ?? selected}
                <button
                  onClick={() => { setSelected("all"); setVisibleCount(PAGE_SIZE); }}
                  className="ml-0.5 hover:text-foreground"
                  aria-label="Remove source filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
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
                {sort === "oldest" ? "Oldest first" : "Title A-Z"}
                <button
                  onClick={() => { setSort("newest"); setVisibleCount(PAGE_SIZE); }}
                  className="ml-0.5 hover:text-foreground"
                  aria-label="Remove sort"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {tagFilter && (
              <Badge variant="secondary" className="gap-1 text-xs font-normal">
                <Tag className="h-3 w-3" />
                {tagFilter}
                <button
                  onClick={() => { setTagFilter(null); setSidebarSection("all"); setVisibleCount(PAGE_SIZE); }}
                  className="ml-0.5 hover:text-foreground"
                  aria-label="Remove tag filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Select all bar */}
      {visible.length > 0 && (
        <div className="flex items-center gap-2 px-1 pb-2">
          <Checkbox
            data-testid="context-select-all"
            checked={allVisibleChecked}
            onCheckedChange={toggleAll}
            aria-label="Select all"
          />
          <span className="text-xs text-muted-foreground">
            {allVisibleChecked ? "Deselect all" : "Select all"}
          </span>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-1">
        {visible.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
        ) : viewMode === "grid" ? (
          <div data-testid="context-items-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visible.map((item) => (
              <ContextGridCard
                key={item.id}
                item={item}
                isChecked={checkedIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
                onDelete={handleDeleteItem}
                onPin={handlePin}
                onArchive={handleArchive}
                onTagClick={handleTagClick}
                deletingId={deletingItemId}
                onInfoClick={(item) => { setInfoPanelItem(item); setInfoPanelOpen(true); }}
              />
            ))}
          </div>
        ) : (
          <div data-testid="context-items-list" className="rounded-lg border overflow-hidden" role="list">
            {visible.map((item) => (
              <ContextListRow
                key={item.id}
                item={item}
                isChecked={checkedIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
                onDelete={handleDeleteItem}
                onPin={handlePin}
                onArchive={handleArchive}
                onTagClick={handleTagClick}
                deletingId={deletingItemId}
                onInfoClick={(item) => { setInfoPanelItem(item); setInfoPanelOpen(true); }}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center py-6">
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
        <div data-testid="bulk-action-bar" className="sticky bottom-0 border-t bg-card px-4 py-2.5 flex items-center justify-between rounded-b-lg">
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

      <ContextInfoPanel
        item={infoPanelItem}
        open={infoPanelOpen}
        onOpenChange={setInfoPanelOpen}
        onPin={handlePin}
        onArchive={handleArchive}
        onTagClick={handleTagClick}
      />
      </div>
    </div>
  );
}
