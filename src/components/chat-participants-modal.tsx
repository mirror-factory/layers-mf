"use client";

import * as React from "react";
import { X, UserPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberRole = "owner" | "participant" | "viewer";

interface ConversationMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  addedAt: string; // ISO date
}

export interface ChatParticipantsModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  currentUserId: string;
  isOwner: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function avatarInitial(name: string): string {
  return (name.charAt(0) || "?").toUpperCase();
}

const roleBadgeVariant: Record<MemberRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  participant: "secondary",
  viewer: "outline",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatParticipantsModal({
  open,
  onClose,
  conversationId,
  currentUserId,
  isOwner,
}: ChatParticipantsModalProps) {
  const [members, setMembers] = React.useState<ConversationMember[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null);

  // Add-member form state
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [addName, setAddName] = React.useState("");
  const [addEmail, setAddEmail] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  // Fetch members when modal opens
  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function fetchMembers() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (!res.ok) throw new Error("Failed to load participants");
        const data = await res.json();
        if (!cancelled) {
          setMembers(data.members ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId]);

  // Reset add form when modal closes
  React.useEffect(() => {
    if (!open) {
      setShowAddForm(false);
      setAddName("");
      setAddEmail("");
      setConfirmRemoveId(null);
    }
  }, [open]);

  // -- Handlers ---------------------------------------------------------------

  async function handleRemoveMember(memberId: string) {
    if (confirmRemoveId !== memberId) {
      setConfirmRemoveId(memberId);
      return;
    }

    setRemovingId(memberId);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/members/${memberId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      // Silently handle — member list stays unchanged
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  }

  async function handleChangeRole(memberId: string, newRole: MemberRole) {
    // Optimistic update
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );
      if (!res.ok) throw new Error("Failed to update role");
    } catch {
      // Revert on failure — refetch
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: m.role } : m))
      );
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) return;

    setAdding(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: addName.trim(), email: addEmail.trim() }),
        }
      );
      if (!res.ok) throw new Error("Failed to add member");
      const data = await res.json();
      setMembers((prev) => [...prev, data.member]);
      setShowAddForm(false);
      setAddName("");
      setAddEmail("");
    } catch {
      // Silently handle
    } finally {
      setAdding(false);
    }
  }

  // -- Render -----------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Participants
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                ({members.length})
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Manage conversation participants
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8" data-testid="loading-spinner">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && members.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No other participants yet. You are the only one in this conversation.
          </div>
        )}

        {/* Member list */}
        {!loading && !error && members.length > 0 && (
          <ul className="space-y-1" role="list" aria-label="Participants list">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 transition-colors"
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                    member.role === "owner"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {avatarInitial(member.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {member.name}
                    </span>
                    <Badge variant={roleBadgeVariant[member.role]} className="text-[10px] px-1.5 py-0">
                      {member.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Added {formatAddedDate(member.addedAt)}
                  </p>
                </div>

                {/* Owner actions */}
                {isOwner && member.role !== "owner" && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Role selector */}
                    <Select
                      value={member.role}
                      onValueChange={(v) =>
                        handleChangeRole(member.id, v as MemberRole)
                      }
                    >
                      <SelectTrigger className="h-7 w-[100px] text-xs" aria-label={`Change role for ${member.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="participant">participant</SelectItem>
                        <SelectItem value="viewer">viewer</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removingId === member.id}
                      aria-label={`Remove ${member.name}`}
                    >
                      {removingId === member.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : confirmRemoveId === member.id ? (
                        <span className="text-[10px] font-medium text-destructive">
                          Sure?
                        </span>
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add member section */}
        {isOwner && !loading && (
          <div className="border-t pt-3">
            {!showAddForm ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowAddForm(true)}
              >
                <UserPlus className="h-4 w-4" />
                Add member
              </Button>
            ) : (
              <form onSubmit={handleAddMember} className="space-y-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  aria-label="New member name"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  aria-label="New member email"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={adding} className="flex-1">
                    {adding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddName("");
                      setAddEmail("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
