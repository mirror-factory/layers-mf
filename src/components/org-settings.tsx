"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Users, FileText, Plug, AlertTriangle } from "lucide-react";

interface OrgData {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  context_item_count: number;
  integration_count: number;
}

export function OrgSettings({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const fetchOrg = useCallback(async () => {
    const res = await fetch("/api/settings/org");
    if (res.ok) {
      const data = await res.json();
      setOrg(data);
      setName(data.name);
    }
  }, []);

  useEffect(() => {
    fetchOrg().finally(() => setLoading(false));
  }, [fetchOrg]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.length < 2 || name.length > 100) {
      toast.error("Name must be between 2 and 100 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(typeof body.error === "string" ? body.error : "Failed to update");
        return;
      }
      toast.success("Organization name updated");
      await fetchOrg();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/org", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(typeof body.error === "string" ? body.error : "Failed to delete");
        return;
      }
      toast.success("Organization deleted");
      router.push("/login");
    } finally {
      setDeleting(false);
      setConfirmText("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <p className="text-sm text-muted-foreground">
        Unable to load organization details.
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid="org-settings">
      {/* Org name */}
      <Card>
        <CardHeader>
          <CardTitle>Organization name</CardTitle>
          <CardDescription>
            This is the display name for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organization name"
                minLength={2}
                maxLength={100}
                disabled={!isOwner}
              />
            </div>
            {isOwner && (
              <Button type="submit" disabled={saving || name === org.name}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            Organization statistics and details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{org.member_count}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{org.context_item_count}</p>
                <p className="text-xs text-muted-foreground">Context items</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Plug className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{org.integration_count}</p>
                <p className="text-xs text-muted-foreground">Integrations</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Created {new Date(org.created_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Danger zone (owner only) */}
      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Delete organization</p>
              <p className="text-sm text-muted-foreground mt-1">
                This will permanently delete all data including context items,
                sessions, integrations, and team members. This action cannot be
                undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="delete-org-btn">
                  Delete organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Are you absolutely sure?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{org.name}</strong> and
                    all associated data. Type <strong>DELETE</strong> below to
                    confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  data-testid="delete-confirm-input"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmText("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={confirmText !== "DELETE" || deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="delete-confirm-btn"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Delete organization"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
