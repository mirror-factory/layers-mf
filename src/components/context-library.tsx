"use client";

import { useState } from "react";
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
} from "lucide-react";

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

function normalizeSource(source: string) {
  if (source === "gdrive") return "google-drive";
  if (source === "github-app") return "github";
  return source;
}

export function ContextLibrary({ items }: Props) {
  const [selected, setSelected] = useState<string>("all");

  // Group items by normalized source
  const groups = items.reduce<Record<string, ContextItem[]>>((acc, item) => {
    const key = normalizeSource(item.source_type);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sources = Object.keys(groups).sort();
  const filtered = selected === "all" ? items : (groups[selected] ?? []);

  const [sourceOpen, setSourceOpen] = useState(false);

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
          {/* All */}
          <button
            onClick={() => { setSelected("all"); setSourceOpen(false); }}
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
                onClick={() => { setSelected(key); setSourceOpen(false); }}
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
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b bg-card gap-2">
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
          <span className="text-xs text-muted-foreground">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nothing here yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((item) => {
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
        </div>
      </div>
    </div>
  );
}
