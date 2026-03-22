"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  FileText,
  HardDrive,
  Github,
  Upload,
  Hash,
  Mic,
  GitBranch,
  Brain,
  Loader,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextResult {
  id: string;
  title: string;
  descriptionShort: string | null;
  description_short?: string | null;
  sourceType: string;
  source_type?: string;
  contentType: string;
  content_type?: string;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: {
    id: string;
    title: string;
    description_short: string | null;
    source_type: string;
    content_type: string;
  }) => void;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  "google-drive": HardDrive,
  gdrive: HardDrive,
  github: Github,
  "github-app": Github,
  slack: Hash,
  granola: Mic,
  linear: GitBranch,
  upload: Upload,
  "layers-ai": Brain,
};

const SOURCE_COLORS: Record<string, string> = {
  "google-drive": "text-blue-500",
  gdrive: "text-blue-500",
  github: "text-slate-600 dark:text-slate-400",
  "github-app": "text-slate-600 dark:text-slate-400",
  slack: "text-purple-500",
  granola: "text-orange-500",
  linear: "text-indigo-500",
  upload: "text-green-600",
  "layers-ai": "text-primary",
};

export function AddItemDialog({
  open,
  onOpenChange,
  onAdd,
}: AddItemDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContextResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/context/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), limit: 20 }),
      });
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  function handleAdd(item: ContextResult) {
    onAdd({
      id: item.id,
      title: item.title,
      description_short: item.descriptionShort ?? item.description_short ?? null,
      source_type: item.sourceType ?? item.source_type ?? "upload",
      content_type: item.contentType ?? item.content_type ?? "document",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Context Item</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search your context library..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto divide-y">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No matching items found.
            </p>
          )}

          {!loading && !searched && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Type to search your context library.
            </p>
          )}

          {!loading &&
            results.map((item) => {
              const sourceType = item.sourceType ?? item.source_type ?? "upload";
              const contentType = item.contentType ?? item.content_type ?? "document";
              const Icon = SOURCE_ICONS[sourceType] ?? FileText;
              const color = SOURCE_COLORS[sourceType] ?? "text-muted-foreground";

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2.5 px-1 group"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {sourceType}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0"
                      >
                        {contentType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleAdd(item)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
