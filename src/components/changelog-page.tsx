"use client";

import { useState } from "react";
import { changelog, type ChangelogEntry } from "@/data/changelog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Wrench,
  FileText,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<
  ChangelogEntry["changes"][number]["type"],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  feat: {
    label: "Feature",
    icon: Sparkles,
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  fix: {
    label: "Fix",
    icon: Wrench,
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  docs: {
    label: "Docs",
    icon: FileText,
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  refactor: {
    label: "Refactor",
    icon: RefreshCw,
    className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
};

function groupChangesByType(changes: ChangelogEntry["changes"]) {
  const groups: Record<string, ChangelogEntry["changes"]> = {};
  const order: ChangelogEntry["changes"][number]["type"][] = ["feat", "fix", "docs", "refactor"];

  for (const change of changes) {
    if (!groups[change.type]) {
      groups[change.type] = [];
    }
    groups[change.type].push(change);
  }

  return order
    .filter((type) => groups[type])
    .map((type) => ({ type, changes: groups[type] }));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function VersionEntry({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) {
  const [open, setOpen] = useState(false);
  const grouped = groupChangesByType(entry.changes);

  return (
    <div className="relative flex gap-6">
      {/* Timeline dot and line */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "mt-6 h-3 w-3 shrink-0 rounded-full border-2",
            isLatest
              ? "border-primary bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb,139,92,246),0.5)]"
              : "border-muted-foreground/40 bg-background"
          )}
        />
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <Card className="mb-8 flex-1 border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs",
                isLatest
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              v{entry.version}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDate(entry.date)}
            </span>
            {isLatest && (
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
                Latest
              </Badge>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {entry.title}
          </h2>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Highlights */}
          <ul className="space-y-2">
            {entry.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>

          {/* Expandable changes */}
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
              All changes ({entry.changes.length})
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-4">
              {grouped.map(({ type, changes }) => {
                const config = TYPE_CONFIG[type];
                const Icon = config.icon;

                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {config.label}s
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        ({changes.length})
                      </span>
                    </div>
                    <ul className="space-y-1.5 pl-5">
                      {changes.map((change, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Badge
                            variant="outline"
                            className={cn("mt-0.5 shrink-0 text-[10px] px-1.5 py-0", config.className)}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-muted-foreground">{change.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}

export function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        {/* Neural dots animation bar */}
        <div className="mx-auto mb-6 flex items-center justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
              style={{
                animationDelay: `${i * 200}ms`,
                animationDuration: "2s",
              }}
            />
          ))}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Changelog
        </h1>
        <p className="mt-2 text-muted-foreground">
          What&apos;s new in Layers
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {changelog.map((entry, i) => (
          <VersionEntry key={entry.version} entry={entry} isLatest={i === 0} />
        ))}

        {/* Timeline end cap */}
        <div className="relative flex gap-6">
          <div className="relative flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-border" />
          </div>
          <p className="pb-4 text-xs text-muted-foreground/50">
            The beginning
          </p>
        </div>
      </div>

    </div>
  );
}
