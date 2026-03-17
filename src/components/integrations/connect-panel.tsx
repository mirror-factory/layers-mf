"use client";

import Nango from "@nangohq/frontend";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plug, Loader2 } from "lucide-react";
import {
  IntegrationCard,
  type Integration,
  type SyncProgress,
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
  const [syncProgress, setSyncProgress] = useState<Record<string, SyncProgress>>({});
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState<
    Record<string, "idle" | "triggered" | "polling" | "complete" | "timeout" | "error">
  >({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

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

  // Clean up polling timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
  }, []);

  async function handleSyncTrigger(integration: Integration): Promise<boolean> {
    try {
      const res = await fetch("/api/integrations/sync-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: integration.nango_connection_id,
          provider: integration.provider,
        }),
      });

      if (!res.ok) {
        // Background trigger not available — fall back to streaming
        return false;
      }

      const data = await res.json();
      if (data.fallback) {
        // Server fell back to streaming sync; let caller use streaming instead
        return false;
      }

      // Background sync triggered successfully — start polling
      const originalSyncAt = integration.last_sync_at;
      setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "triggered" }));

      const startTime = Date.now();
      const POLL_INTERVAL = 3000;
      const MAX_POLL_DURATION = 60000;

      // Clear any existing poll for this integration
      if (pollTimers.current[integration.id]) {
        clearInterval(pollTimers.current[integration.id]);
      }

      pollTimers.current[integration.id] = setInterval(async () => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= MAX_POLL_DURATION) {
          clearInterval(pollTimers.current[integration.id]);
          delete pollTimers.current[integration.id];
          setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "timeout" }));
          // Clear timeout status after 5 seconds
          setTimeout(() => {
            setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "idle" }));
          }, 5000);
          return;
        }

        setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "polling" }));

        try {
          const pollRes = await fetch("/api/integrations");
          if (!pollRes.ok) return;

          const updated: Integration[] = await pollRes.json();
          const current = updated.find((i) => i.id === integration.id);

          if (current) {
            setIntegrations(updated);

            if (current.last_sync_at && current.last_sync_at !== originalSyncAt) {
              // Sync completed
              clearInterval(pollTimers.current[integration.id]);
              delete pollTimers.current[integration.id];
              setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "complete" }));
              // Clear complete status after 5 seconds
              setTimeout(() => {
                setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "idle" }));
              }, 5000);
            }
          }
        } catch {
          // Polling fetch failed; keep trying
        }
      }, POLL_INTERVAL);

      return true;
    } catch {
      setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "error" }));
      setTimeout(() => {
        setBackgroundSyncStatus((prev) => ({ ...prev, [integration.id]: "idle" }));
      }, 3000);
      return false;
    }
  }

  async function handleSync(integration: Integration) {
    setSyncing(integration.id);
    setSyncResults((prev) => ({ ...prev, [integration.id]: "" }));
    setSyncDebug((prev) => ({ ...prev, [integration.id]: [] }));
    setSyncProgress((prev) => ({
      ...prev,
      [integration.id]: { phase: "fetching", message: "Starting sync..." },
    }));

    try {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: integration.nango_connection_id,
          provider: integration.provider,
        }),
      });

      if (!res.ok) {
        // Non-streaming error response (auth errors, validation, etc.)
        const data = await res.json().catch(() => ({ error: "Sync failed" }));
        setSyncResults((prev) => ({
          ...prev,
          [integration.id]: data.error ?? "Sync failed",
        }));
        setSyncProgress((prev) => ({
          ...prev,
          [integration.id]: { phase: "error", message: data.error ?? "Sync failed" },
        }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setSyncResults((prev) => ({
          ...prev,
          [integration.id]: "Sync failed — no stream",
        }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines from buffer
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.phase === "fetching") {
              setSyncProgress((prev) => ({
                ...prev,
                [integration.id]: {
                  phase: "fetching",
                  message: data.message,
                },
              }));
            } else if (data.phase === "processing") {
              setSyncProgress((prev) => ({
                ...prev,
                [integration.id]: {
                  phase: "processing",
                  current: data.current,
                  total: data.total,
                  title: data.title,
                },
              }));
            } else if (data.phase === "complete") {
              const label =
                data.processed > 0
                  ? `${data.processed} item${data.processed === 1 ? "" : "s"} synced`
                  : "Nothing new to import";
              setSyncResults((prev) => ({ ...prev, [integration.id]: label }));
              setSyncProgress((prev) => ({
                ...prev,
                [integration.id]: {
                  phase: "complete",
                  processed: data.processed,
                  fetched: data.fetched,
                },
              }));
            } else if (data.phase === "error") {
              // Individual item errors — don't stop the sync, just note it
              setSyncProgress((prev) => ({
                ...prev,
                [integration.id]: {
                  ...prev[integration.id],
                  phase: prev[integration.id]?.phase === "processing"
                    ? "processing"
                    : "error",
                  message: data.message,
                },
              }));
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      await fetchIntegrations();
    } catch {
      setSyncResults((prev) => ({
        ...prev,
        [integration.id]: "Sync failed",
      }));
      setSyncProgress((prev) => ({
        ...prev,
        [integration.id]: { phase: "error", message: "Sync failed" },
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
    <div className="space-y-4" data-testid="connect-panel">
      {/* Connect button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="integrations-count">
          {integrations.length} integration{integrations.length !== 1 ? "s" : ""} connected
        </p>
        <Button onClick={handleConnect} disabled={connecting} data-testid="connect-button">
          {connecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plug className="h-4 w-4 mr-2" />
          )}
          {connecting ? "Connecting..." : "Connect"}
        </Button>
      </div>

      {connectError && (
        <p className="text-sm text-destructive">{connectError}</p>
      )}

      {/* Integration cards */}
      {integrations.length > 0 ? (
        <div className="space-y-3" data-testid="integrations-list">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onSync={handleSync}
              onSyncTrigger={handleSyncTrigger}
              onDisconnect={handleDisconnect}
              syncing={syncing === integration.id}
              syncResult={syncResults[integration.id]}
              syncDebug={syncDebug[integration.id]}
              syncProgress={syncProgress[integration.id]}
              backgroundSyncStatus={backgroundSyncStatus[integration.id] ?? "idle"}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="integrations-empty">
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
