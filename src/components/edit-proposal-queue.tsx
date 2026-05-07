"use client";

import { useState, useEffect, useCallback } from "react";
import { EditProposalCard, type EditProposal } from "@/components/edit-proposal-card";
import { FileEdit } from "lucide-react";

const POLL_INTERVAL = 30_000;

export function EditProposalQueue() {
  const [proposals, setProposals] = useState<EditProposal[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/edit-proposals?status=all");
      if (!res.ok) return;
      const json = await res.json();
      setProposals(json.proposals ?? []);
      if (json.user_id) setCurrentUserId(json.user_id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
    const interval = setInterval(fetchProposals, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchProposals]);

  async function handleVote(id: string, vote: "approve" | "reject") {
    const res = await fetch(`/api/edit-proposals/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    if (!res.ok) return;
    // Refetch to get updated state
    await fetchProposals();
  }

  const pending = proposals.filter((p) => p.status === "pending");
  const resolved = proposals.filter((p) => p.status !== "pending");

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border bg-muted/50"
          />
        ))}
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileEdit className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No edit proposals yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pending ({pending.length})
          </h3>
          {pending.map((p) => (
            <EditProposalCard
              key={p.id}
              proposal={p}
              currentUserId={currentUserId}
              onVote={handleVote}
            />
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Resolved ({resolved.length})
          </h3>
          {resolved.map((p) => (
            <EditProposalCard
              key={p.id}
              proposal={p}
              currentUserId={currentUserId}
              onVote={handleVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
