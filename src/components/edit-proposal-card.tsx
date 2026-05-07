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
  Check,
  ChevronDown,
  Clock,
  FileEdit,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditProposal {
  id: string;
  context_item_id: string;
  org_id: string;
  proposed_by: string;
  proposed_title: string | null;
  proposed_content: string;
  change_summary: string | null;
  status: "pending" | "approved" | "rejected";
  approvals: Array<{ user_id: string; approved: boolean; timestamp: string }>;
  required_approvals: number;
  created_at: string;
  context_items?: { id: string; title: string } | null;
}

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

interface EditProposalCardProps {
  proposal: EditProposal;
  currentUserId: string;
  onVote: (id: string, vote: "approve" | "reject") => Promise<void>;
}

export function EditProposalCard({ proposal, currentUserId, onVote }: EditProposalCardProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [contentOpen, setContentOpen] = useState(false);

  const statusStyle = STATUS_STYLES[proposal.status] ?? STATUS_STYLES.pending;
  const isPending = proposal.status === "pending";
  const isOwnProposal = proposal.proposed_by === currentUserId;
  const hasVoted = proposal.approvals.some((a) => a.user_id === currentUserId);
  const approveCount = proposal.approvals.filter((a) => a.approved).length;
  const rejectCount = proposal.approvals.filter((a) => !a.approved).length;
  const canVote = isPending && !isOwnProposal && !hasVoted;

  const documentTitle = proposal.context_items?.title ?? "Untitled document";

  async function handleVote(vote: "approve" | "reject") {
    setLoading(vote);
    try {
      await onVote(proposal.id, vote);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className={cn(!isPending && "opacity-70")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 gap-1">
              <FileEdit className="h-3 w-3" />
              Edit Proposal
            </Badge>
            {!isPending && (
              <Badge variant="outline" className={statusStyle.className}>
                {proposal.status === "approved" && <Check className="mr-1 h-3 w-3" />}
                {proposal.status === "rejected" && <X className="mr-1 h-3 w-3" />}
                {statusStyle.label}
              </Badge>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTimestamp(proposal.created_at)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">{documentTitle}</p>
          {proposal.change_summary && (
            <p className="text-sm text-muted-foreground mt-1">{proposal.change_summary}</p>
          )}
        </div>

        {/* Vote progress */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-emerald-500" />
            {approveCount}/{proposal.required_approvals} approvals
          </span>
          {rejectCount > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsDown className="h-3 w-3 text-red-500" />
              {rejectCount} rejected
            </span>
          )}
          {isOwnProposal && (
            <Badge variant="outline" className="text-[10px] py-0">Your proposal</Badge>
          )}
          {hasVoted && !isOwnProposal && (
            <Badge variant="outline" className="text-[10px] py-0">Voted</Badge>
          )}
        </div>

        {/* Proposed content preview */}
        <Collapsible open={contentOpen} onOpenChange={setContentOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                contentOpen && "rotate-180"
              )}
            />
            View proposed changes
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
              {proposal.proposed_content}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {canVote && (
        <CardFooter className="gap-2">
          <Button
            size="sm"
            onClick={() => handleVote("approve")}
            disabled={loading !== null}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading === "approve" ? "Approving..." : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleVote("reject")}
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
