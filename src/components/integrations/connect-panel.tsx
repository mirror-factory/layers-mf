"use client";

import Nango from "@nangohq/frontend";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plug, Loader2 } from "lucide-react";
import {
  IntegrationCard,
  type Integration,
} from "@/components/integrations/integration-card";

interface ConnectPanelProps {
  initialIntegrations: Integration[];
}

export function ConnectPanel({ initialIntegrations }: ConnectPanelProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});
  const [syncDebug, setSyncDebug] = useState<Record<string, string[]>>({});

  const fetchIntegrations = useCallback(async () => {
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const data: Integration[] = await res.json();
      setIntegrations(data);
    }
  }, []);

  // Refresh on window focus (after OAuth redirect)
  useEffect(() => {
    function handleFocus() {
      fetchIntegrations();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchIntegrations]);

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
      const res = await fetch("/api/integrations/connect-session", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create connect session");
      }
      const { sessionToken } = await res.json();

      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "close") {
            setConnecting(false);
            await fetchIntegrations();
            return;
          }
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
            } catch {}
            setConnecting(false);
            await fetchIntegrations();
          } else {
            setConnecting(false);
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "Connection failed"
      );
      setConnecting(false);
    }
  }

  async function handleSync(integration: Integration) {
    setSyncing(integration.id);
    setSyncResults((prev) => ({ ...prev, [integration.id]: "" }));
    setSyncDebug((prev) => ({ ...prev, [integration.id]: [] }));

    try {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: integration.nango_connection_id,
          provider: integration.provider,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const label =
          data.processed > 0
            ? `${data.processed} item${data.processed === 1 ? "" : "s"} synced`
            : "Nothing new to import";
        setSyncResults((prev) => ({ ...prev, [integration.id]: label }));
        if (data.debug?.length) {
          setSyncDebug((prev) => ({
            ...prev,
            [integration.id]: data.debug,
          }));
        }
        await fetchIntegrations();
      } else {
        setSyncResults((prev) => ({
          ...prev,
          [integration.id]: data.error ?? "Sync failed",
        }));
      }
    } catch {
      setSyncResults((prev) => ({
        ...prev,
        [integration.id]: "Sync failed",
      }));
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect(integration: Integration) {
    const res = await fetch(`/api/integrations/${integration.id}`, {
      method: "DELETE",
    });
    if (res.ok || res.status === 204) {
      setIntegrations((prev) => prev.filter((i) => i.id !== integration.id));
    }
  }

  return (
    <div className="space-y-4">
      {/* Connect button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {integrations.length} integration{integrations.length !== 1 ? "s" : ""} connected
        </p>
        <Button onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plug className="h-4 w-4 mr-2" />
          )}
          {connecting ? "Connecting…" : "Connect"}
        </Button>
      </div>

      {connectError && (
        <p className="text-sm text-destructive">{connectError}</p>
      )}

      {/* Integration cards */}
      {integrations.length > 0 ? (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
              syncing={syncing === integration.id}
              syncResult={syncResults[integration.id]}
              syncDebug={syncDebug[integration.id]}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Plug className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium text-foreground">
            No integrations connected
          </p>
          <p className="text-xs mt-1">
            Connect your tools to sync knowledge into Layers automatically.
          </p>
        </div>
      )}
    </div>
  );
}
