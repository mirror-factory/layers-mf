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

const PROVIDERS = [
  { key: "granola", label: "Granola", description: "Meeting transcripts and notes" },
  { key: "linear", label: "Linear", description: "Issues, projects, and cycles" },
  { key: "google-drive", label: "Google Drive", description: "Documents and files" },
] as const;

export function IntegrationsConnect({ integrations }: IntegrationsConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedProviders = new Set(integrations.map((i) => i.provider));

  async function handleConnect() {
    setConnecting(true);
    setError(null);

    try {
      // Get a short-lived session token from our backend
      const res = await fetch("/api/integrations/connect-session", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create connect session");
      const { sessionToken } = await res.json();

      // Open Nango's pre-built Connect UI (no public key needed)
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: (event) => {
          if (event.type === "close") {
            setConnecting(false);
          } else if (event.type === "connect") {
            // Nango will fire an auth webhook → our /api/webhooks/nango saves the connection
            setConnecting(false);
            // Refresh to show updated status
            window.location.reload();
          }
        },
      });

      connect.setSessionToken(sessionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Connect button — opens Nango's unified connect UI */}
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

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Provider list */}
      <div className="divide-y rounded-lg border">
        {PROVIDERS.map((p) => {
          const isConnected = connectedProviders.has(p.key);
          const integration = integrations.find((i) => i.provider === p.key);
          return (
            <div key={p.key} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">
                      {integration?.last_sync_at
                        ? `Synced ${new Date(integration.last_sync_at).toLocaleDateString()}`
                        : "Connected"}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Not connected</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
