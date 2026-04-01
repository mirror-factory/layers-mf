"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText, HardDrive, Github, Upload, Hash, GitBranch, Mic,
  ExternalLink, Loader2, Clock, Copy, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "google-drive": { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  gdrive:         { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  github:         { label: "GitHub",       icon: Github,    color: "text-slate-400" },
  "github-app":   { label: "GitHub",       icon: Github,    color: "text-slate-400" },
  slack:          { label: "Slack",        icon: Hash,      color: "text-purple-500" },
  granola:        { label: "Granola",      icon: Mic,       color: "text-orange-500" },
  linear:         { label: "Linear",       icon: GitBranch, color: "text-indigo-500" },
  upload:         { label: "Uploads",      icon: Upload,    color: "text-green-600" },
  "layers-ai":    { label: "AI Generated", icon: FileText,  color: "text-primary" },
};

interface ContextInfoPanelProps {
  item: {
    id: string;
    title: string;
    description_short: string | null;
    source_type: string;
    content_type: string;
    status: string;
    ingested_at: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContextInfoPanel({ item, open, onOpenChange }: ContextInfoPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item || !open) {
      setContent(null);
      return;
    }
    setLoading(true);
    fetch(`/api/context/${item.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setContent(data?.raw_content ?? null);
      })
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [item?.id, open]);

  if (!item) return null;

  const source = SOURCE_META[item.source_type] ?? {
    label: item.source_type, icon: FileText, color: "text-muted-foreground",
  };
  const SourceIcon = source.icon;

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary" className="gap-1.5">
              <SourceIcon className={cn("h-3 w-3", source.color)} />
              {source.label}
            </Badge>
            <Badge variant="outline">{item.content_type.replace(/_/g, " ")}</Badge>
            <Badge variant={item.status === "ready" ? "default" : "secondary"}>
              {item.status}
            </Badge>
          </div>
          <SheetTitle className="text-left text-lg leading-snug">
            {item.title}
          </SheetTitle>
          {item.description_short && (
            <SheetDescription className="text-left">
              {item.description_short}
            </SheetDescription>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(item.ingested_at).toLocaleDateString("en-US", {
              year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}</span>
          </div>
        </SheetHeader>

        {/* Content preview */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Content Preview</h3>
            <div className="flex items-center gap-1">
              {content && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs h-7">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <pre className="rounded-lg border bg-muted/30 p-4 text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
              {content.slice(0, 3000)}
              {content.length > 3000 && "\n\n... (truncated)"}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No content available.</p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-2">
          <Button asChild className="flex-1">
            <Link href={`/context/${item.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Detail
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
