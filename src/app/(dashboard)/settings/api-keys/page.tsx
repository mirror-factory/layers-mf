"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Key, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  masked_key: string;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (!res.ok) throw new Error("Failed to fetch keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "Default" }),
      });
      if (!res.ok) throw new Error("Failed to create key");
      const data = await res.json();
      setRevealedKey(data.key);
      setNewKeyName("");
      setShowCreate(false);
      await fetchKeys();
      toast.success("API key created");
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete key");
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("API key revoked");
    } catch {
      toast.error("Failed to revoke API key");
    } finally {
      setDeletingId(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">API Keys</h1>
        <p className="text-muted-foreground text-sm">
          Manage API keys for programmatic access to your organization&apos;s data.
        </p>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <Card className="mb-6 border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-2">
                  Copy your API key now. It will not be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                    {revealedKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(revealedKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 text-xs"
                  onClick={() => setRevealedKey(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create key */}
      <div className="mb-6">
        {showCreate ? (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label htmlFor="key-name" className="text-sm font-medium">
                Key name
              </label>
              <Input
                id="key-name"
                placeholder="e.g. Production API"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setNewKeyName("");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Key
          </Button>
        )}
      </div>

      {/* Key list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No API keys yet. Generate one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {k.name}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(k.id)}
                    disabled={deletingId === k.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="font-mono text-xs">
                  {k.masked_key}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Created{" "}
                    {new Date(k.created_at).toLocaleDateString()}
                  </span>
                  {k.last_used_at && (
                    <span>
                      Last used{" "}
                      {new Date(k.last_used_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
