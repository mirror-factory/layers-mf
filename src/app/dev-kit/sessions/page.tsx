/**
 * Sessions List Page  --  /dev-kit/sessions
 * ==========================================
 * Displays a filterable table of all recorded AI sessions. Each row shows
 * session name, status (running / complete / error), model used, total
 * tokens, total cost, duration, and timestamp. Rows link to the trace
 * detail page at /dev-kit/sessions/[id].
 *
 * Filters: status, model, date range (simple <select> dropdowns).
 *
 * Fetches live data from /api/dev-kit/sessions; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRealtimeData, RealtimeIndicator } from "../use-realtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionStatus = "running" | "complete" | "error";

interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  model: string;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
  timestamp: string; // ISO string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: SessionStatus) {
  const base = "inline-block px-2 py-0.5 rounded text-xs font-medium";
  switch (status) {
    case "running":
      return `${base} bg-[#3dffc0]/15 text-[#3dffc0]`;
    case "complete":
      return `${base} bg-white/10 text-[#f0f0f0]`;
    case "error":
      return `${base} bg-[#ef4444]/15 text-[#ef4444]`;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const realtime = useRealtimeData({ tables: ['traces'] });

  // Re-fetch when new traces arrive via realtime
  useEffect(() => {
    if (realtime.eventCount > 0) {
      fetch('/api/dev-kit/sessions')
        .then(r => r.json())
        .then(d => setSessions(Array.isArray(d) ? d : d.sessions ?? []))
        .catch(() => {});
    }
  }, [realtime.eventCount]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  useEffect(() => {
    fetch('/api/dev-kit/sessions')
      .then(r => r.json())
      .then(d => { setSessions(Array.isArray(d) ? d : d.sessions ?? []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  const models = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.model))),
    [sessions],
  );

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (modelFilter !== "all" && s.model !== modelFilter) return false;
      return true;
    });
  }, [sessions, statusFilter, modelFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Sessions</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No sessions recorded yet. Sessions appear automatically when your app makes AI SDK calls with the Langfuse instrumentation active.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Recorded AI sessions with trace-level detail.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm
                     text-[#f0f0f0] focus:outline-none focus:ring-1 focus:ring-[#3dffc0]"
        >
          <option value="all">All Statuses</option>
          <option value="running">Running</option>
          <option value="complete">Complete</option>
          <option value="error">Error</option>
        </select>

        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm
                     text-[#f0f0f0] focus:outline-none focus:ring-1 focus:ring-[#3dffc0]"
        >
          <option value="all">All Models</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-[#f0f0f0]/50">
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3 text-right">Tokens</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-[#f0f0f0]/40"
                >
                  No sessions match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr
                key={s.id}
                className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dev-kit/sessions/${s.id}`}
                    className="text-[#3dffc0] hover:underline"
                  >
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={statusBadge(s.status)}>{s.status}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{s.model}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {s.totalTokens.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  ${s.totalCost.toFixed(3)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatDuration(s.durationMs)}
                </td>
                <td className="px-4 py-3 text-right text-[#f0f0f0]/60">
                  {formatDate(s.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
