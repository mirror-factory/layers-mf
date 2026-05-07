"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Search, UserPlus, X, Share2 } from "lucide-react";

// --- Types ---

interface ShareDialogProps {
  contentId: string;
  contentType: "context_item" | "artifact";
  trigger: React.ReactNode;
}

interface OrgMember {
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface ContentShare {
  id: string;
  content_id: string;
  content_type: string;
  shared_by: string;
  shared_with: string;
  permission: string;
  created_at: string;
  sharedByProfile: { display_name: string | null; email: string | null; avatar_url: string | null } | null;
  sharedWithProfile: { display_name: string | null; email: string | null; avatar_url: string | null } | null;
}

type Permission = "viewer" | "editor" | "owner";

const PERMISSION_LABELS: Record<Permission, string> = {
  viewer: "Viewer",
  editor: "Editor",
  owner: "Owner",
};

const PERMISSION_COLORS: Record<Permission, string> = {
  viewer: "bg-blue-500/10 text-blue-700 border-blue-200",
  editor: "bg-amber-500/10 text-amber-700 border-amber-200",
  owner: "bg-green-500/10 text-green-700 border-green-200",
};

// --- Avatar ---

function UserAvatar({ name, avatarUrl, className }: { name: string; avatarUrl?: string | null; className?: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={cn("flex items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0 overflow-hidden", className ?? "h-8 w-8")}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-muted-foreground">{initials || "?"}</span>
      )}
    </div>
  );
}

// --- Component ---

export function ShareDialog({ contentId, contentType, trigger }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<ContentShare[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [search, setSearch] = useState("");
  const [permission, setPermission] = useState<Permission>("viewer");
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sharing?content_id=${contentId}`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        const memberList = (data.members ?? []).map(
          (m: { user_id: string; display_name: string | null; email: string | null; avatar_url: string | null }) => ({
            userId: m.user_id,
            displayName: m.display_name,
            email: m.email,
            avatarUrl: m.avatar_url,
          })
        );
        setMembers(memberList);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchShares();
      fetchMembers();
    }
  }, [open, fetchShares, fetchMembers]);

  const alreadySharedWith = new Set(shares.map((s) => s.shared_with));

  const filteredMembers = members.filter((m) => {
    if (alreadySharedWith.has(m.userId)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.displayName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  });

  async function handleShare(userId: string) {
    setSharing(true);
    try {
      const res = await fetch("/api/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          contentType,
          sharedWith: userId,
          permission,
        }),
      });
      if (res.ok) {
        await fetchShares();
        setSearch("");
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleRemove(shareId: string) {
    setRemovingId(shareId);
    try {
      const res = await fetch(`/api/sharing/${shareId}`, { method: "DELETE" });
      if (res.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handlePermissionChange(shareId: string, newPermission: Permission) {
    try {
      const res = await fetch(`/api/sharing/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: newPermission }),
      });
      if (res.ok) {
        setShares((prev) =>
          prev.map((s) => (s.id === shareId ? { ...s, permission: newPermission } : s))
        );
      }
    } catch {
      // Silent fail
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            Share {contentType === "context_item" ? "Context Item" : "Artifact"}
          </DialogTitle>
          <DialogDescription>
            Invite team members and control their access level.
          </DialogDescription>
        </DialogHeader>

        {/* Search + Permission selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={permission} onValueChange={(v) => setPermission(v as Permission)}>
            <SelectTrigger className="w-[110px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search results */}
        {search.trim() && (
          <div className="border rounded-lg max-h-[160px] overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No matching team members
              </p>
            ) : (
              filteredMembers.map((m) => {
                const name = m.displayName ?? m.email ?? "Unknown";
                return (
                  <button
                    key={m.userId}
                    onClick={() => handleShare(m.userId)}
                    disabled={sharing}
                    className="flex items-center gap-3 w-full px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                  >
                    <UserAvatar name={name} avatarUrl={m.avatarUrl} className="h-7 w-7" />
                    <div className="flex-1 min-w-0">
                      {m.displayName && (
                        <p className="text-sm font-medium truncate">{m.displayName}</p>
                      )}
                      {m.email && (
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      )}
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Current shares */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Shared with ({shares.length})
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Not shared with anyone yet.
            </p>
          ) : (
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {shares.map((share) => {
                const profile = share.sharedWithProfile;
                const name = profile?.display_name ?? profile?.email ?? "Unknown";
                const perm = share.permission as Permission;

                return (
                  <div key={share.id} className="flex items-center gap-3 px-3 py-2">
                    <UserAvatar
                      name={name}
                      avatarUrl={profile?.avatar_url}
                      className="h-7 w-7"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      {profile?.email && profile.display_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.email}
                        </p>
                      )}
                    </div>

                    <Select
                      value={perm}
                      onValueChange={(v) => handlePermissionChange(share.id, v as Permission)}
                    >
                      <SelectTrigger className="w-[100px] h-7 text-xs border-0 bg-transparent">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", PERMISSION_COLORS[perm])}
                        >
                          {PERMISSION_LABELS[perm]}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>

                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(share.id)}
                            disabled={removingId === share.id}
                          >
                            {removingId === share.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove access</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
