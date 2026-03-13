"use client";

import Link from "next/link";
import { Circle, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/db/action-items";

const STATUS_ICON = {
  pending: Circle,
  done: CheckCircle2,
  cancelled: XCircle,
} as const;

const STATUS_STYLE = {
  pending: "text-muted-foreground hover:text-primary",
  done: "text-green-500",
  cancelled: "text-muted-foreground/50",
} as const;

const SOURCE_LABEL: Record<string, string> = {
  "google-drive": "Drive",
  gdrive: "Drive",
  github: "GitHub",
  linear: "Linear",
  discord: "Discord",
  granola: "Granola",
  upload: "Upload",
  slack: "Slack",
};

function isOverdue(item: ActionItem): boolean {
  // Items with no date can't be overdue; only pending items can be overdue
  // We consider items older than 7 days as overdue if still pending
  if (item.status !== "pending" || !item.source_created_at) return false;
  const age = Date.now() - new Date(item.source_created_at).getTime();
  return age > 7 * 24 * 60 * 60 * 1000;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface ActionItemRowProps {
  item: ActionItem;
  onStatusChange: (
    contextItemId: string,
    actionIndex: number,
    newStatus: "pending" | "done" | "cancelled"
  ) => void;
}

export function ActionItemRow({ item, onStatusChange }: ActionItemRowProps) {
  const Icon = STATUS_ICON[item.status];
  const overdue = isOverdue(item);

  function cycleStatus() {
    const next = item.status === "pending" ? "done" : "pending";
    onStatusChange(item.context_item_id, item.action_index, next);
  }

  return (
    <tr data-testid="action-item-row" className={cn("hover:bg-muted/30 group", item.status === "cancelled" && "opacity-50")}>
      {/* Status toggle */}
      <td className="px-4 py-2.5 w-10">
        <button
          onClick={cycleStatus}
          className={cn("transition-colors", STATUS_STYLE[item.status])}
          title={item.status === "pending" ? "Mark done" : "Mark pending"}
        >
          <Icon className="h-4 w-4" />
        </button>
      </td>

      {/* Task */}
      <td className="px-4 py-2.5">
        <span
          className={cn(
            "text-sm",
            item.status === "done" && "line-through text-muted-foreground",
            item.status === "cancelled" && "line-through text-muted-foreground"
          )}
        >
          {item.task}
        </span>
        {overdue && (
          <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            Overdue
          </Badge>
        )}
      </td>

      {/* Source */}
      <td className="px-4 py-2.5">
        <Link
          href={`/context/${item.context_item_id}`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          <span className="max-w-[200px] truncate inline-block align-bottom">
            {item.source_title}
          </span>
        </Link>
        <span className="text-[10px] text-muted-foreground ml-1.5">
          {SOURCE_LABEL[item.source_type] ?? item.source_type}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
        {item.completed_at
          ? formatDate(item.completed_at)
          : formatDate(item.source_created_at)}
      </td>

      {/* Cancel action (visible on hover) */}
      <td className="px-4 py-2.5 w-10">
        {item.status === "pending" && (
          <button
            onClick={() =>
              onStatusChange(item.context_item_id, item.action_index, "cancelled")
            }
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            title="Cancel"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
