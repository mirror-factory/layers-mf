"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface SyncConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  provider: string;
}

type SyncConfig = Record<string, unknown>;

export function SyncConfigDialog({
  open,
  onOpenChange,
  integrationId,
  provider,
}: SyncConfigDialogProps) {
  const [config, setConfig] = useState<SyncConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/integrations/${integrationId}/config`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load config");
        return res.json();
      })
      .then((data) => setConfig(data.sync_config ?? {}))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load config")
      )
      .finally(() => setLoading(false));
  }, [open, integrationId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_config: config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save config");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function updateConfig(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  const providerLabel = PROVIDER_LABELS[provider] ?? provider;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {providerLabel} Sync</DialogTitle>
          <DialogDescription>
            Control which data gets synced from {providerLabel}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <ProviderConfig
              provider={provider}
              config={config}
              updateConfig={updateConfig}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  slack: "Slack",
  "google-drive": "Google Drive",
  github: "GitHub",
  "github-app": "GitHub",
  linear: "Linear",
  discord: "Discord",
  granola: "Granola",
};

// ── Per-provider config forms ────────────────────────────────────────────

function ProviderConfig({
  provider,
  config,
  updateConfig,
}: {
  provider: string;
  config: SyncConfig;
  updateConfig: (key: string, value: unknown) => void;
}) {
  if (provider === "slack") return <SlackConfig config={config} updateConfig={updateConfig} />;
  if (provider === "google-drive") return <GoogleDriveConfig config={config} updateConfig={updateConfig} />;
  if (provider.includes("github")) return <GitHubConfig config={config} updateConfig={updateConfig} />;
  if (provider === "linear") return <LinearConfig config={config} updateConfig={updateConfig} />;
  if (provider === "discord") return <DiscordConfig config={config} updateConfig={updateConfig} />;
  if (provider === "granola") return <GranolaConfig config={config} updateConfig={updateConfig} />;

  return (
    <p className="text-sm text-muted-foreground">
      No configuration options available for this provider.
    </p>
  );
}

interface ConfigProps {
  config: SyncConfig;
  updateConfig: (key: string, value: unknown) => void;
}

function SlackConfig({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="slack-channels">Channel filter</Label>
        <Input
          id="slack-channels"
          placeholder="general, engineering, product (comma-separated, empty = all)"
          value={(config.channels as string[] | undefined)?.join(", ") ?? ""}
          onChange={(e) => {
            const val = e.target.value.trim();
            updateConfig(
              "channels",
              val ? val.split(",").map((s) => s.trim()).filter(Boolean) : null
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          Channel names or IDs to sync. Leave empty to sync all channels.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Max messages per channel</Label>
        <Select
          value={String(config.max_messages ?? 200)}
          onValueChange={(v) => updateConfig("max_messages", Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
            <SelectItem value="500">500</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="slack-exclude-bots">Exclude bot messages</Label>
        <Switch
          id="slack-exclude-bots"
          checked={(config.exclude_bots as boolean) ?? true}
          onCheckedChange={(v) => updateConfig("exclude_bots", v)}
        />
      </div>
    </>
  );
}

const GDRIVE_FILE_TYPES = [
  { key: "docs", label: "Google Docs" },
  { key: "sheets", label: "Sheets / CSV" },
  { key: "slides", label: "Slides" },
  { key: "pdfs", label: "PDFs" },
  { key: "word", label: "Word (.docx)" },
] as const;

function GoogleDriveConfig({ config, updateConfig }: ConfigProps) {
  const fileTypes = (config.file_types as string[] | undefined) ?? GDRIVE_FILE_TYPES.map((t) => t.key);

  function toggleFileType(key: string, checked: boolean) {
    const updated = checked
      ? [...fileTypes, key]
      : fileTypes.filter((t) => t !== key);
    updateConfig("file_types", updated);
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="gdrive-folders">Folder filter</Label>
        <Input
          id="gdrive-folders"
          placeholder="Projects, Shared (comma-separated, empty = all)"
          value={(config.folder_filter as string) ?? ""}
          onChange={(e) => updateConfig("folder_filter", e.target.value || null)}
        />
        <p className="text-xs text-muted-foreground">
          Folder names to include. Leave empty to sync all folders.
        </p>
      </div>

      <div className="space-y-2">
        <Label>File types to sync</Label>
        <div className="space-y-2 pl-1">
          {GDRIVE_FILE_TYPES.map((type) => (
            <div key={type.key} className="flex items-center gap-2">
              <Checkbox
                id={`gdrive-${type.key}`}
                checked={fileTypes.includes(type.key)}
                onCheckedChange={(checked) =>
                  toggleFileType(type.key, checked === true)
                }
              />
              <Label htmlFor={`gdrive-${type.key}`} className="text-sm font-normal">
                {type.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Max files per sync</Label>
        <Select
          value={String(config.max_files ?? 100)}
          onValueChange={(v) => updateConfig("max_files", Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function GitHubConfig({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="github-repos">Repository filter</Label>
        <Input
          id="github-repos"
          placeholder="org/repo1, org/repo2 (comma-separated, empty = all)"
          value={(config.repos as string[] | undefined)?.join(", ") ?? ""}
          onChange={(e) => {
            const val = e.target.value.trim();
            updateConfig(
              "repos",
              val ? val.split(",").map((s) => s.trim()).filter(Boolean) : null
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          Repository names to sync. Leave empty to sync all accessible repos.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="github-closed">Include closed issues</Label>
        <Switch
          id="github-closed"
          checked={(config.include_closed as boolean) ?? true}
          onCheckedChange={(v) => updateConfig("include_closed", v)}
        />
      </div>

      <div className="space-y-2">
        <Label>Max repositories</Label>
        <Select
          value={String(config.max_repos ?? 10)}
          onValueChange={(v) => updateConfig("max_repos", Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function LinearConfig({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="linear-teams">Team filter</Label>
        <Input
          id="linear-teams"
          placeholder="Engineering, Product (comma-separated, empty = all)"
          value={(config.teams as string[] | undefined)?.join(", ") ?? ""}
          onChange={(e) => {
            const val = e.target.value.trim();
            updateConfig(
              "teams",
              val ? val.split(",").map((s) => s.trim()).filter(Boolean) : null
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          Team names to include. Leave empty to sync all teams.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="linear-archived">Include archived issues</Label>
        <Switch
          id="linear-archived"
          checked={(config.include_archived as boolean) ?? false}
          onCheckedChange={(v) => updateConfig("include_archived", v)}
        />
      </div>

      <div className="space-y-2">
        <Label>Max items per sync</Label>
        <Select
          value={String(config.max_items ?? 100)}
          onValueChange={(v) => updateConfig("max_items", Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="300">300</SelectItem>
            <SelectItem value="500">500</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function DiscordConfig({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="discord-servers">Server filter</Label>
        <Input
          id="discord-servers"
          placeholder="Server name (comma-separated, empty = all)"
          value={(config.servers as string[] | undefined)?.join(", ") ?? ""}
          onChange={(e) => {
            const val = e.target.value.trim();
            updateConfig(
              "servers",
              val ? val.split(",").map((s) => s.trim()).filter(Boolean) : null
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          Server names to sync. Leave empty to sync all servers.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discord-channels">Channel filter</Label>
        <Input
          id="discord-channels"
          placeholder="general, announcements (comma-separated, empty = all)"
          value={(config.channels as string[] | undefined)?.join(", ") ?? ""}
          onChange={(e) => {
            const val = e.target.value.trim();
            updateConfig(
              "channels",
              val ? val.split(",").map((s) => s.trim()).filter(Boolean) : null
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          Channel names to sync. Leave empty to sync all channels.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Max messages per channel</Label>
        <Select
          value={String(config.max_messages ?? 100)}
          onValueChange={(v) => updateConfig("max_messages", Number(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function GranolaConfig({ config, updateConfig }: ConfigProps) {
  return (
    <div className="space-y-2">
      <Label>Max documents per sync</Label>
      <Select
        value={String(config.max_documents ?? 50)}
        onValueChange={(v) => updateConfig("max_documents", Number(v))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="20">20</SelectItem>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
