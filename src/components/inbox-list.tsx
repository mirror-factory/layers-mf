"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCheck, ExternalLink, X, Inbox,
  AlertTriangle, CircleDot, MessageSquare, FileText, Clock,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trackInteraction } from "@/lib/tracking";

type InboxItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  priority: string;
  status: string;
  source_url: string | null;
  source_type: string | null;
  created_at: string;
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  urgent: { label: "Urgent", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: AlertTriangle },
  high: { label: "High", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20", icon: AlertTriangle },
  normal: { label: "Normal", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: CircleDot },
  low: { label: "Low", color: "bg-muted text-muted-foreground border-border", icon: CircleDot },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  action_item: { label: "Action Item", icon: CheckCheck },
  decision: { label: "Decision", icon: CircleDot },
  mention: { label: "Mention", icon: MessageSquare },
  new_context: { label: "New Context", icon: FileText },
  overdue: { label: "Overdue", icon: Clock },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function InboxList({ initialItems }: { initialItems: InboxItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<string>("all");
  const supabase = createClient();

  async function updateStatus(id: string, status: "read" | "acted" | "dismissed") {
    const item = items.find((i) => i.id === id);
    if (status === "dismissed" && item) {
      trackInteraction({
        type: "dismiss",
        resourceType: "inbox_item",
        resourceId: id,
        sourceType: item.source_type ?? undefined,
        metadata: { itemType: item.type, priority: item.priority },
      });
    }
    if (status === "acted" && item) {
      trackInteraction({
        type: "click",
        resourceType: "inbox_item",
        resourceId: id,
        sourceType: item.source_type ?? undefined,
        metadata: { itemType: item.type, priority: item.priority },
      });
    }
    setItems((prev) => prev.filter((i) => (status === "dismissed" ? i.id !== id : true)).map((i) =>
      i.id === id ? { ...i, status } : i
    ));
    await supabase.from("inbox_items").update({ status, read_at: new Date().toISOString() }).eq("id", id);
  }

  async function dismissAll() {
    const ids = visible.map((i) => i.id);
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    for (const id of ids) {
      await supabase.from("inbox_items").update({ status: "dismissed" }).eq("id", id);
    }
  }

  const visible = items
    .filter((i) => i.status !== "dismissed")
    .filter((i) => filter === "all" || i.type === filter || i.priority === filter);

  // Count by type for filter badges
  const allVisible = items.filter((i) => i.status !== "dismissed");
  const typeCounts = allVisible.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});
  const urgentCount = allVisible.filter((i) => i.priority === "urgent" || i.priority === "high").length;

  if (allVisible.length === 0) {
    return (
      <div data-testid="inbox-empty-state" className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="rounded-full bg-green-500/10 p-4 mb-4">
          <Inbox className="h-8 w-8 text-green-500" />
        </div>
        <p className="text-sm font-medium text-foreground">All caught up</p>
        <p className="text-xs mt-1 max-w-xs text-center">
          No action items, decisions, or mentions right now. New items appear as your agents process documents and meetings.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="inbox-items-list" className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={filter === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("all")}
        >
          All {allVisible.length}
        </Badge>
        {urgentCount > 0 && (
          <Badge
            variant={filter === "urgent" ? "default" : "outline"}
            className="cursor-pointer text-red-600 border-red-500/30"
            onClick={() => setFilter(filter === "urgent" ? "all" : "urgent")}
          >
            Urgent {urgentCount}
          </Badge>
        )}
        {Object.entries(typeCounts).map(([type, count]) => (
          <Badge
            key={type}
            variant={filter === type ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter(filter === type ? "all" : type)}
          >
            {TYPE_CONFIG[type]?.label ?? type} {count}
          </Badge>
        ))}
        {allVisible.length > 3 && (
          <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground" onClick={dismissAll}>
            Dismiss all
          </Button>
        )}
      </div>

      {/* Items */}
      {visible.map((item) => {
        const priority = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.normal;
        const typeConfig = TYPE_CONFIG[item.type] ?? { label: item.type, icon: CircleDot };
        const TypeIcon = typeConfig.icon;
        const isUrgent = item.priority === "urgent" || item.priority === "high";

        return (
          <div
            key={item.id}
            data-testid="inbox-item"
            className={cn(
              "group rounded-lg border bg-card transition-all hover:shadow-sm",
              item.status === "acted" && "opacity-50",
              isUrgent && "border-l-2 border-l-orange-500",
            )}
          >
            <div className="flex items-start gap-3 p-4">
              {/* Type icon */}
              <div className={cn("rounded-lg p-2 shrink-0 mt-0.5", priority.color)}>
                <TypeIcon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {typeConfig.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(item.created_at)}
                  </span>
                  {item.source_type && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {item.source_type}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug">{item.title}</p>
                {item.body && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.source_url && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" title="Open source">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                  onClick={() => updateStatus(item.id, "acted")}
                  title="Mark done"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => updateStatus(item.id, "dismissed")}
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {visible.length === 0 && filter !== "all" && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No items match this filter.
          <button onClick={() => setFilter("all")} className="ml-1 text-primary hover:underline">
            Show all
          </button>
        </div>
      )}
    </div>
  );
}
