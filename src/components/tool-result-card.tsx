"use client";

import { NeuralDots } from "@/components/ui/neural-dots";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface Citation {
  url: string;
  title?: string;
  favicon?: string;
}

interface ToolResultCardProps {
  toolName: string;
  state: "running" | "complete" | "error";
  label?: string;
  source?: string;
  children?: React.ReactNode;
  citations?: Citation[];
  className?: string;
}

function faviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  } catch {
    return "";
  }
}

function StatusIcon({ state }: { state: ToolResultCardProps["state"] }) {
  if (state === "running") {
    return <NeuralDots size={14} dotCount={6} active className="shrink-0" />;
  }
  if (state === "complete") {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  }
  return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
}

export function ToolResultCard({
  toolName,
  state,
  label,
  source,
  children,
  citations,
  className,
}: ToolResultCardProps) {
  const displayLabel =
    label ?? toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={cn("py-1.5", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <StatusIcon state={state} />
        <span
          className={cn(
            "font-medium",
            state === "running" && "text-muted-foreground animate-pulse",
            state === "complete" && "text-foreground",
            state === "error" && "text-red-400"
          )}
        >
          {displayLabel}
        </span>
        {source && (
          <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            {source}
          </span>
        )}
      </div>

      {/* Body */}
      {children && (
        <div className="mt-1.5 border-l border-border/40 pl-3 text-sm text-muted-foreground">
          {children}
        </div>
      )}

      {/* Citations */}
      {citations && citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/30 pt-1.5">
          {citations.map((cite) => {
            const favicon = cite.favicon || faviconUrl(cite.url);
            const displayTitle =
              cite.title ||
              (() => {
                try {
                  return new URL(cite.url).hostname;
                } catch {
                  return cite.url;
                }
              })();

            return (
              <a
                key={cite.url}
                href={cite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-emerald-400 transition-colors"
              >
                {favicon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favicon}
                    alt=""
                    width={12}
                    height={12}
                    className="rounded-sm"
                  />
                )}
                <span className="max-w-[180px] truncate">{displayTitle}</span>
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
