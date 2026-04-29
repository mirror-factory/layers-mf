/**
 * Connectors Page  --  /dev-kit/connectors
 * =========================================
 * Displays all connected external integrations and services. Each
 * connector shows:
 *   - Name and type
 *   - Health status: healthy (green), degraded (yellow), disconnected (gray)
 *   - Last successful sync timestamp
 *   - Error count
 *
 * Fetches live data from /api/dev-kit/connectors; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectorHealth = "healthy" | "degraded" | "disconnected";

interface Connector {
  id: string;
  name: string;
  type: string;
  health: ConnectorHealth;
  lastSync: string;
  errorCount: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function healthDot(health: ConnectorHealth): string {
  switch (health) {
    case "healthy":
      return "bg-[#3dffc0]";
    case "degraded":
      return "bg-yellow-400";
    case "disconnected":
      return "bg-[#f0f0f0]/25";
  }
}

function healthText(health: ConnectorHealth): {
  label: string;
  color: string;
} {
  switch (health) {
    case "healthy":
      return { label: "Healthy", color: "text-[#3dffc0]" };
    case "degraded":
      return { label: "Degraded", color: "text-yellow-400" };
    case "disconnected":
      return { label: "Disconnected", color: "text-[#f0f0f0]/40" };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-kit/connectors')
      .then(r => r.json())
      .then(d => { setConnectors(Array.isArray(d) ? d : d.data ?? []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading connectors...
      </div>
    );
  }

  if (connectors.length === 0) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Connectors</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No connectors configured. Add API keys for Linear, Firecrawl, or Slack to see connector health here.</p>
      </div>
    </div>
  );

  const healthyCt = connectors.filter((c) => c.health === "healthy").length;
  const degradedCt = connectors.filter((c) => c.health === "degraded").length;
  const disconnectedCt = connectors.filter(
    (c) => c.health === "disconnected",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Connectors</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          External integrations and their health status.
        </p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded border border-[#3dffc0]/20 px-3 py-1.5 text-[#3dffc0]">
          Healthy: {healthyCt}
        </span>
        <span className="rounded border border-yellow-400/20 px-3 py-1.5 text-yellow-400">
          Degraded: {degradedCt}
        </span>
        <span className="rounded border border-white/10 px-3 py-1.5 text-[#f0f0f0]/50">
          Disconnected: {disconnectedCt}
        </span>
      </div>

      {/* Connector cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {connectors.map((conn) => {
          const ht = healthText(conn.health);
          return (
            <div
              key={conn.id}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-3"
            >
              {/* Name + health */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{conn.name}</p>
                  <p className="text-xs text-[#f0f0f0]/40">{conn.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${healthDot(conn.health)}`}
                  />
                  <span className={`text-xs font-medium ${ht.color}`}>
                    {ht.label}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[#f0f0f0]/60 flex-1">
                {conn.description}
              </p>

              {/* Footer meta */}
              <div className="flex items-center justify-between text-xs text-[#f0f0f0]/40 pt-3 border-t border-white/5">
                <span>Last sync: {formatDate(conn.lastSync)}</span>
                <span
                  className={
                    conn.errorCount > 0
                      ? "text-[#ef4444]"
                      : "text-[#f0f0f0]/40"
                  }
                >
                  Errors: {conn.errorCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
