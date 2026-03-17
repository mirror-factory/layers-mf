"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  Pin,
  Lightbulb,
  AlertTriangle,
  Link2,
  ListChecks,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Insight = {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  severity: string;
  source_item_ids: string[];
  status: string;
  created_at: string;
};

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  new_content: {
    icon: FileText,
    label: "New Content",
    color: "text-blue-500",
  },
  cross_source_connection: {
    icon: Link2,
    label: "Connection",
    color: "text-purple-500",
  },
  contradiction: {
    icon: AlertTriangle,
    label: "Contradiction",
    color: "text-amber-500",
  },
  action_item: {
    icon: ListChecks,
    label: "Action Item",
    color: "text-green-500",
  },
  summary_delta: {
    icon: Lightbulb,
    label: "Summary Update",
    color: "text-cyan-500",
  },
};

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  info: "secondary",
  important: "default",
  critical: "destructive",
};

export function SessionInsights({ sessionId }: { sessionId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/insights?status=active`
      );
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  async function handleUpdateStatus(
    insightId: string,
    status: "dismissed" | "pinned"
  ) {
    const res = await fetch(`/api/sessions/${sessionId}/insights`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId, status }),
    });
    if (res.ok) {
      setInsights((prev) => prev.filter((i) => i.id !== insightId));
      toast.success(status === "dismissed" ? "Insight dismissed" : "Insight pinned");
    } else {
      toast.error("Failed to update insight");
    }
  }

  if (loading) {
    return null;
  }

  if (insights.length === 0) {
    return (
      <div
        data-testid="session-insights-empty"
        className="px-4 py-3 text-center"
      >
        <p className="text-xs text-muted-foreground">No new insights</p>
      </div>
    );
  }

  return (
    <div data-testid="session-insights" className="flex flex-col">
      <div className="px-4 py-2 border-b">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          New since your last visit ({insights.length})
        </p>
      </div>
      <div className="divide-y">
        {insights.map((insight) => {
          const config = TYPE_CONFIG[insight.insight_type] ?? TYPE_CONFIG.new_content;
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              data-testid="insight-card"
              className="px-3 py-2.5 group"
            >
              <div className="flex items-start gap-2">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 mt-0.5 shrink-0",
                    config.color
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-medium leading-snug line-clamp-2">
                      {insight.title}
                    </p>
                    <Badge
                      variant={SEVERITY_VARIANT[insight.severity] ?? "secondary"}
                      className="text-[9px] px-1 py-0 shrink-0"
                    >
                      {insight.severity}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-3">
                    {insight.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {config.label}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleUpdateStatus(insight.id, "pinned")}
                    className="p-0.5 rounded hover:bg-accent"
                    title="Pin insight"
                  >
                    <Pin className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(insight.id, "dismissed")}
                    className="p-0.5 rounded hover:bg-accent"
                    title="Dismiss insight"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
