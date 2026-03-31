"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCw,
  X,
  HardDrive,
  Github,
  Hash,
  Mic,
  GitBranch,
  Upload,
  FileText,
} from "lucide-react";

type Suggestion = {
  id: string;
  title: string;
  reason: string;
  source_type: string;
  content_type: string;
  score: number;
  ingested_at: string;
};

const SOURCE_BADGE: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  "google-drive": { label: "Drive", icon: HardDrive, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  github: { label: "GitHub", icon: Github, color: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300" },
  slack: { label: "Slack", icon: Hash, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  granola: { label: "Granola", icon: Mic, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  linear: { label: "Linear", icon: GitBranch, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  upload: { label: "Upload", icon: Upload, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

export function DittoSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/ditto/suggestions");
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      // Silently fail — widget is non-critical
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSuggestions();
  };

  const handleDismiss = async (id: string) => {
    // Optimistically remove
    setSuggestions((prev) => prev.filter((s) => s.id !== id));

    // Track dismiss interaction
    fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "dismiss",
        resourceType: "context_item",
        resourceId: id,
      }),
    }).catch(() => {});
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium">For You</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium">For You</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect more sources and search to help Ditto learn your preferences
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium">For You</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-7 px-2 text-xs text-muted-foreground"
        >
          <RefreshCw
            className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {suggestions.map((suggestion) => {
            const source = SOURCE_BADGE[suggestion.source_type] ?? {
              label: suggestion.source_type,
              icon: FileText,
              color: "bg-muted text-muted-foreground",
            };
            const SourceIcon = source.icon;

            return (
              <div
                key={suggestion.id}
                className="group flex items-start gap-3 rounded-md px-2 py-2 -mx-2 hover:bg-accent/50 transition-colors"
              >
                <Link
                  href={`/context/${suggestion.id}`}
                  className="flex items-start gap-3 flex-1 min-w-0"
                >
                  <div
                    className={`rounded-md p-1.5 shrink-0 ${source.color}`}
                  >
                    <SourceIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {suggestion.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {suggestion.reason}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-accent"
                  title="Not interested"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
