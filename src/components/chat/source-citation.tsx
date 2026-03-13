"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SourceBadge, getSourceLabel } from "./source-badge";

export interface CitationSource {
  id: string;
  title: string;
  source_type: string;
  content_type: string;
  source_url: string | null;
  source_created_at: string | null;
  rrf_score: number;
  description_short: string | null;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

interface SourceCitationProps {
  sources: CitationSource[];
  maxVisible?: number;
}

export function SourceCitation({ sources, maxVisible = 4 }: SourceCitationProps) {
  if (sources.length === 0) return null;

  const visible = sources.slice(0, maxVisible);
  const overflow = sources.length - maxVisible;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap gap-1.5 px-1" data-testid="source-citation">
        {visible.map((s) => {
          const date = formatDate(s.source_created_at);
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <Link href={`/context/${s.id}`}>
                  <Badge
                    variant="outline"
                    className="gap-1.5 px-2 py-0.5 font-normal cursor-pointer hover:bg-accent transition-colors"
                  >
                    <SourceBadge sourceType={s.source_type} />
                    <span className="max-w-[140px] truncate text-xs">{s.title}</span>
                    {date && (
                      <span className="text-[10px] text-muted-foreground">{date}</span>
                    )}
                    {s.source_url && (
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                    )}
                  </Badge>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <p className="text-xs font-medium">{s.title}</p>
                  {s.description_short && (
                    <p className="text-xs text-muted-foreground">{s.description_short}</p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{getSourceLabel(s.source_type)}</span>
                    <span>·</span>
                    <span>{s.content_type.replace(/_/g, " ")}</span>
                    {date && (
                      <>
                        <span>·</span>
                        <span>{date}</span>
                      </>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <Badge variant="outline" className="px-2 py-0.5 font-normal text-muted-foreground">
            +{overflow} more
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}
