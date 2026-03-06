"use client";

import Nango from "@nangohq/frontend";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plug, Check, Loader2 } from "lucide-react";

interface Integration {
  id: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
}

interface IntegrationsConnectProps {
  integrations: Integration[];
}

// Known providers with friendly labels — anything connected but not listed here
// will still show up under "Connected" with its raw provider key.
const PROVIDER_META: Record<string, { label: string; description: string }> = {
  granola: { label: "Granola", description: "Meeting transcripts and notes" },
  linear: { label: "Linear", description: "Issues, projects, and cycles" },
  "google-drive": { label: "Google Drive", description: "Documents and files" },
  github: { label: "GitHub", description: "Repositories and issues" },
  "github-app": { label: "GitHub", description: "Repositories and issues" },
  slack: { label: "Slack", description: "Messages and channels" },
};

export function IntegrationsConnect({ integrations }: IntegrationsConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

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
    setSaveError(null);
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
          // Log the raw event so we can see the actual shape in dev tools
          console.log("[Nango] event:", JSON.stringify(event));

          if (event.type === "close") {
            setConnecting(false);
            return;
          }

          // Nango may use "connect" or "connection_created" depending on SDK version.
          // Extract connectionId/providerConfigKey from wherever they live in the event.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = event as any;
          const connectionId: string =
            e.connectionId ??
            e.payload?.connectionId ??
            e.connection?.connectionId ??
            "";
          const provider: string =
            e.providerConfigKey ??
            e.payload?.providerConfigKey ??
            e.connection?.providerConfigKey ??
            "";

          if (connectionId && provider) {
            try {
              await saveConnection(connectionId, provider);
            } catch (err) {
              setSaveError(err instanceof Error ? err.message : "Failed to save connection");
            }
            setConnecting(false);
            window.location.reload();
          } else {
            // Event fired but no connection info — just close
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

      {connectError && (
        <p className="text-sm text-destructive">{connectError}</p>
      )}
      {saveError && (
        <p className="text-sm text-destructive">Connected but failed to save: {saveError}</p>
      )}

      {/* Connected integrations from DB — shown regardless of provider key */}
      {integrations.length > 0 && (
        <div className="divide-y rounded-lg border">
          {integrations.map((integration) => {
            const meta = PROVIDER_META[integration.provider];
            return (
              <div key={integration.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{meta?.label ?? integration.provider}</p>
                  {meta && <p className="text-xs text-muted-foreground">{meta.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">
                    {integration.last_sync_at
                      ? `Synced ${new Date(integration.last_sync_at).toLocaleDateString()}`
                      : "Connected"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {integrations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No integrations connected yet. Click the button above to get started.
        </p>
      )}
    </div>
  );
}
