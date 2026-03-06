"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCheck, ExternalLink, X, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-muted text-muted-foreground",
};

const TYPE_LABELS: Record<string, string> = {
  action_item: "Action",
  decision: "Decision",
  mention: "Mention",
  new_context: "New",
  overdue: "Overdue",
};

export function InboxList({ initialItems }: { initialItems: InboxItem[] }) {
  const [items, setItems] = useState(initialItems);
  const supabase = createClient();

  async function updateStatus(id: string, status: "read" | "acted" | "dismissed") {
    setItems((prev) => prev.filter((i) => (status === "dismissed" ? i.id !== id : true)).map((i) =>
      i.id === id ? { ...i, status } : i
    ));
    await supabase.from("inbox_items").update({ status, read_at: new Date().toISOString() }).eq("id", id);
  }

  const visible = items.filter((i) => i.status !== "dismissed");

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Inbox className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">All caught up — no items in your inbox.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-4 rounded-lg border p-4 bg-card transition-opacity",
            item.status === "read" && "opacity-60"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_STYLES[item.priority])}>
                {item.priority}
              </span>
              <span className="text-xs text-muted-foreground">
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm font-medium">{item.title}</p>
            {item.body && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.body}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.source_url && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700"
              onClick={() => updateStatus(item.id, "acted")}
              title="Mark as acted"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateStatus(item.id, "dismissed")}
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
