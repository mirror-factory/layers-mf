"use client";

import { type MouseEvent } from "react";
import {
  X,
  FileText,
  HardDrive,
  Github,
  Upload,
  Hash,
  Mic,
  GitBranch,
  Brain,
  StickyNote,
  Type,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanvasItem } from "./canvas-workspace";

const SOURCE_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string; border: string }
> = {
  "google-drive": {
    label: "Google Drive",
    icon: HardDrive,
    color: "text-blue-500",
    border: "border-l-blue-500",
  },
  gdrive: {
    label: "Google Drive",
    icon: HardDrive,
    color: "text-blue-500",
    border: "border-l-blue-500",
  },
  github: {
    label: "GitHub",
    icon: Github,
    color: "text-slate-600 dark:text-slate-400",
    border: "border-l-slate-500",
  },
  "github-app": {
    label: "GitHub",
    icon: Github,
    color: "text-slate-600 dark:text-slate-400",
    border: "border-l-slate-500",
  },
  slack: {
    label: "Slack",
    icon: Hash,
    color: "text-purple-500",
    border: "border-l-purple-500",
  },
  granola: {
    label: "Granola",
    icon: Mic,
    color: "text-orange-500",
    border: "border-l-orange-500",
  },
  linear: {
    label: "Linear",
    icon: GitBranch,
    color: "text-indigo-500",
    border: "border-l-indigo-500",
  },
  upload: {
    label: "Upload",
    icon: Upload,
    color: "text-green-600",
    border: "border-l-green-600",
  },
  "layers-ai": {
    label: "Granger AI",
    icon: Brain,
    color: "text-primary",
    border: "border-l-primary",
  },
};

const DEFAULT_SOURCE = {
  label: "Document",
  icon: FileText,
  color: "text-muted-foreground",
  border: "border-l-muted-foreground",
};

interface CanvasItemCardProps {
  item: CanvasItem;
  selected: boolean;
  dragging: boolean;
  onMouseDown: (e: MouseEvent) => void;
  onRemove: () => void;
  onContentChange: (content: string) => void;
}

export function CanvasItemCard({
  item,
  selected,
  dragging,
  onMouseDown,
  onRemove,
  onContentChange,
}: CanvasItemCardProps) {
  if (item.item_type === "label") {
    return (
      <div
        data-canvas-item
        className={cn(
          "absolute select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
          selected && "ring-2 ring-primary ring-offset-1 rounded"
        )}
        style={{
          left: `${item.x}px`,
          top: `${item.y}px`,
          width: `${item.width}px`,
        }}
        onMouseDown={onMouseDown}
      >
        <div className="relative group">
          <input
            className="w-full bg-transparent text-sm font-bold border-none outline-none p-1"
            value={item.content ?? ""}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Label..."
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (item.item_type === "note") {
    return (
      <div
        data-canvas-item
        className={cn(
          "absolute select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
          selected && "ring-2 ring-primary ring-offset-1 rounded-lg"
        )}
        style={{
          left: `${item.x}px`,
          top: `${item.y}px`,
          width: `${item.width}px`,
          height: `${item.height}px`,
        }}
        onMouseDown={onMouseDown}
      >
        <div className="relative group h-full">
          <div className="h-full rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <StickyNote className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-[10px] font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
                Note
              </span>
            </div>
            <textarea
              className="w-full h-[calc(100%-2rem)] bg-transparent text-xs border-none outline-none resize-none text-yellow-900 dark:text-yellow-100 placeholder:text-yellow-500/60"
              value={item.content ?? ""}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Write a note..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // Context item card
  const sourceMeta =
    SOURCE_META[item.source_type ?? ""] ?? DEFAULT_SOURCE;
  const SourceIcon = sourceMeta.icon;

  return (
    <div
      data-canvas-item
      className={cn(
        "absolute select-none",
        dragging ? "cursor-grabbing" : "cursor-grab",
        selected && "ring-2 ring-primary ring-offset-1 rounded-lg"
      )}
      style={{
        left: `${item.x}px`,
        top: `${item.y}px`,
        width: `${item.width}px`,
      }}
      onMouseDown={onMouseDown}
    >
      <Card
        className={cn(
          "relative group border-l-[3px] p-3 shadow-sm transition-shadow hover:shadow-md",
          sourceMeta.border
        )}
      >
        {/* Source badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <SourceIcon className={cn("h-3.5 w-3.5", sourceMeta.color)} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {sourceMeta.label}
          </span>
          {item.content_type && (
            <Badge
              variant="secondary"
              className="ml-auto text-[9px] px-1.5 py-0"
            >
              {(item.content_type ?? "").replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium line-clamp-2 leading-snug">
          {item.title ?? "Untitled"}
        </h4>

        {/* Description */}
        {item.description_short && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
            {item.description_short}
          </p>
        )}

        {/* Remove button */}
        <button
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </button>
      </Card>
    </div>
  );
}
