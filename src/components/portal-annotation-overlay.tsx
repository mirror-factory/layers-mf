"use client";

import { useState, useCallback } from "react";
import { X, Info, Lightbulb, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Annotation {
  id: string;
  page: number;
  text: string;
  note: string;
  type: "info" | "highlight" | "warning" | "tip";
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Annotation indicator + tooltip
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  Annotation["type"],
  { icon: React.ElementType; color: string; bg: string; border: string; pulse: string; label: string }
> = {
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    pulse: "bg-blue-400",
    label: "Info",
  },
  highlight: {
    icon: Sparkles,
    color: "text-yellow-400",
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/30",
    pulse: "bg-yellow-400",
    label: "Highlight",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    pulse: "bg-amber-400",
    label: "Warning",
  },
  tip: {
    icon: Lightbulb,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    pulse: "bg-emerald-400",
    label: "Tip",
  },
};

function AnnotationIndicator({
  annotation,
  index,
  onDismiss,
}: {
  annotation: Annotation;
  index: number;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[annotation.type];
  const Icon = config.icon;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className="annotation-enter flex items-start gap-2"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* Pulsing dot + icon button */}
      <button
        onClick={handleToggle}
        className={cn(
          "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
          config.bg,
          config.border,
          expanded && "ring-2 ring-offset-1 ring-offset-transparent",
          expanded && config.border
        )}
        title={`${config.label}: ${annotation.text}`}
      >
        {/* Pulse ring */}
        {!expanded && (
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-40 annotation-pulse",
              config.pulse
            )}
          />
        )}
        <Icon className={cn("relative h-3.5 w-3.5", config.color)} />
      </button>

      {/* Expanded note */}
      {expanded && (
        <div
          className={cn(
            "annotation-expand rounded-lg border px-3 py-2 backdrop-blur-xl max-w-[260px]",
            config.bg,
            config.border
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  config.color
                )}
              >
                {config.label}
              </span>
              {annotation.text && (
                <p className="mt-0.5 text-[11px] text-muted-foreground/70 line-clamp-1 italic">
                  &ldquo;{annotation.text}&rdquo;
                </p>
              )}
              <p className="mt-1 text-xs text-foreground/90 leading-relaxed">
                {annotation.note}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(annotation.id);
              }}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-white/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay: renders annotations grouped by page
// ---------------------------------------------------------------------------

interface AnnotationOverlayProps {
  annotations: Annotation[];
  onDismiss: (id: string) => void;
  currentPage: number;
  totalPages: number;
}

export function AnnotationOverlay({
  annotations,
  onDismiss,
  currentPage,
  totalPages,
}: AnnotationOverlayProps) {
  const visibleAnnotations = annotations.filter((a) => a.visible);
  if (visibleAnnotations.length === 0) return null;

  // Group annotations by page
  const byPage = new Map<number, Annotation[]>();
  for (const ann of visibleAnnotations) {
    const page = Math.max(1, Math.min(ann.page, totalPages || 1));
    const group = byPage.get(page) ?? [];
    group.push(ann);
    byPage.set(page, group);
  }

  // Show annotations for current page and adjacent pages (current-1 to current+2)
  const visiblePages = new Set<number>();
  for (let p = Math.max(1, currentPage - 1); p <= Math.min(totalPages || 1, currentPage + 2); p++) {
    visiblePages.add(p);
  }

  const pagesWithAnnotations = [...byPage.entries()]
    .filter(([page]) => visiblePages.has(page))
    .sort(([a], [b]) => a - b);

  if (pagesWithAnnotations.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 z-30 pointer-events-none w-full h-full">
      {pagesWithAnnotations.map(([page, pageAnnotations]) => (
        <div
          key={page}
          className="pointer-events-auto absolute left-3 flex flex-col gap-2"
          style={{
            // Position relative to page within the scrollable area
            top: `${((page - currentPage + 1) * 120) + 8}px`,
          }}
        >
          {/* Page badge */}
          <span className="text-[9px] text-muted-foreground/40 font-medium">
            p. {page}
          </span>
          {pageAnnotations.map((ann, i) => (
            <AnnotationIndicator
              key={ann.id}
              annotation={ann}
              index={i}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
