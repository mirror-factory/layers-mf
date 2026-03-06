"use client";

import Nango from "@nangohq/frontend";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plug, Check, Loader2, RefreshCw } from "lucide-react";

interface Integration {
  id: string;
  provider: string;
  nango_connection_id: string;
  status: string;
  last_sync_at: string | null;
}

interface IntegrationsConnectProps {
  integrations: Integration[];
}

const PROVIDER_META: Record<string, { label: string; description: string }> = {
  granola:        { label: "Granola",       description: "Meeting transcripts and notes" },
  linear:         { label: "Linear",        description: "Issues, projects, and cycles" },
  "google-drive": { label: "Google Drive",  description: "Documents and files" },
  github:         { label: "GitHub",        description: "Repositories and issues" },
  "github-app":   { label: "GitHub",        description: "Repositories and issues" },
  slack:          { label: "Slack",         description: "Messages and channels" },
};

export function IntegrationsConnect({ integrations }: IntegrationsConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});

  async function saveConnection(connectionId: string, provider: string) {
    const res = await fetch("/api/integrations/save-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, provider }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch("/api/integrations/connect-session", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create connect session");
      }
      const { sessionToken } = await res.json();

      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: async (event) => {
          console.log("[Nango] event:", JSON.stringify(event));

          if (event.type === "close") {
            setConnecting(false);
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = event as any;
          const connectionId: string =
            e.connectionId ?? e.payload?.connectionId ?? e.connection?.connectionId ?? "";
          const provider: string =
            e.providerConfigKey ?? e.payload?.providerConfigKey ?? e.connection?.providerConfigKey ?? "";

          if (connectionId && provider) {
            try {
              await saveConnection(connectionId, provider);
            } catch (err) {
              console.warn("[Nango] save-connection failed:", err);
            }
            setConnecting(false);
            window.location.reload();
          } else {
            setConnecting(false);
          }
        },
      });

      connect.setSessionToken(sessionToken);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  }

  async function handleSync(integration: Integration) {
    setSyncing(integration.id);
    setSyncResults((prev) => ({ ...prev, [integration.id]: "" }));

    try {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: integration.nango_connection_id,
          provider: integration.provider,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const label =
          data.processed > 0
            ? `${data.processed} item${data.processed === 1 ? "" : "s"} added to Context Library`
            : data.note ?? "No exportable content found";
        setSyncResults((prev) => ({ ...prev, [integration.id]: label }));
        if (data.processed > 0) {
          setTimeout(() => window.location.reload(), 1800);
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setSyncResults((prev) => ({
          ...prev,
          [integration.id]: body.error ?? "Sync failed",
        }));
      }
    } catch {
      setSyncResults((prev) => ({ ...prev, [integration.id]: "Sync failed" }));
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          Connect your tools to start syncing knowledge into Layers.
        </p>
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plug className="h-4 w-4 mr-2" />
          )}
          {connecting ? "Connecting…" : "Connect an integration"}
        </Button>
      </div>

      {connectError && <p className="text-sm text-destructive">{connectError}</p>}

      {integrations.length > 0 ? (
        <div className="divide-y rounded-lg border">
          {integrations.map((integration) => {
            const meta = PROVIDER_META[integration.provider];
            const isSyncing = syncing === integration.id;
            const result = syncResults[integration.id];
            return (
              <div
                key={integration.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {meta?.label ?? integration.provider}
                  </p>
                  {meta && (
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-muted-foreground">
                        {integration.last_sync_at
                          ? `Synced ${new Date(
                              integration.last_sync_at
                            ).toLocaleDateString()}`
                          : "Connected"}
                      </span>
                    </div>
                    {result && (
                      <p className="text-xs text-muted-foreground mt-0.5">{result}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(integration)}
                    disabled={isSyncing}
                    className="h-7 text-xs"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    {isSyncing ? "Syncing…" : "Sync now"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No integrations connected yet. Click the button above to get started.
        </p>
      )}
    </div>
  );
}
