"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApprovalItem {
  id: string;
  org_id: string;
  requested_by_agent: string;
  action_type: string;
  target_service: string;
  payload: Record<string, unknown>;
  reasoning: string;
  conflict_reason: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const ACTION_STYLES: Record<string, { label: string; className: string }> = {
  create_task: {
    label: "Create Task",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  send_message: {
    label: "Send Message",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  draft_email: {
    label: "Draft Email",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  update_task: {
    label: "Update Task",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  send_slack: {
    label: "Send Slack",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  update_issue: {
    label: "Update Issue",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground",
  },
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatServiceName(service: string): string {
  return service.charAt(0).toUpperCase() + service.slice(1);
}

interface ApprovalCardProps {
  item: ApprovalItem;
  onAction: (id: string, action: "approve" | "reject") => Promise<void>;
}

export function ApprovalCard({ item, onAction }: ApprovalCardProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [payloadOpen, setPayloadOpen] = useState(false);

  const actionStyle = ACTION_STYLES[item.action_type] ?? {
    label: item.action_type,
    className: "bg-muted text-muted-foreground",
  };
  const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending;
  const isPending = item.status === "pending";

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    try {
      await onAction(item.id, action);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className={cn(!isPending && "opacity-70")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={actionStyle.className}>
              {actionStyle.label}
            </Badge>
            <Badge variant="outline">{formatServiceName(item.target_service)}</Badge>
            {!isPending && (
              <Badge variant="outline" className={statusStyle.className}>
                {item.status === "approved" && <Check className="mr-1 h-3 w-3" />}
                {item.status === "rejected" && <X className="mr-1 h-3 w-3" />}
                {statusStyle.label}
              </Badge>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTimestamp(item.created_at)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{item.reasoning}</p>

        {item.conflict_reason && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {item.conflict_reason}
            </p>
          </div>
        )}

        <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                payloadOpen && "rotate-180"
              )}
            />
            Payload details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(item.payload, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {isPending && (
        <CardFooter className="gap-2">
          <Button
            size="sm"
            onClick={() => handleAction("approve")}
            disabled={loading !== null}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading === "approve" ? "Approving..." : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("reject")}
            disabled={loading !== null}
            className="border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            {loading === "reject" ? "Rejecting..." : "Reject"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
