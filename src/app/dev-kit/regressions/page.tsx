/**
 * Regression Tests Page  --  /dev-kit/regressions
 * =================================================
 * Lists auto-generated regression tests derived from production error
 * traces. Each entry displays:
 *   - Source trace (linked to /dev-kit/sessions/[id])
 *   - Tool name involved
 *   - Error pattern detected
 *   - Generated test file path
 *   - Status: pending | generated | passing | failing
 *
 * Fetches live data from /api/dev-kit/regressions; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegressionStatus = "pending" | "generated" | "passing" | "failing";

interface RegressionTest {
  id: string;
  sourceTraceId: string;
  sourceSessionName: string;
  toolName: string;
  errorPattern: string;
  testFilePath: string | null;
  status: RegressionStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: RegressionStatus): {
  className: string;
  label: string;
} {
  switch (status) {
    case "passing":
      return {
        className: "bg-[#3dffc0]/15 text-[#3dffc0]",
        label: "passing",
      };
    case "failing":
      return {
        className: "bg-[#ef4444]/15 text-[#ef4444]",
        label: "failing",
      };
    case "generated":
      return {
        className: "bg-blue-400/15 text-blue-400",
        label: "generated",
      };
    case "pending":
      return {
        className: "bg-white/10 text-[#f0f0f0]/50",
        label: "pending",
      };
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

export default function RegressionsPage() {
  const [tests, setTests] = useState<RegressionTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-kit/regressions')
      .then(r => r.json())
      .then(d => { setTests(Array.isArray(d) ? d : d.data ?? []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading regressions...
      </div>
    );
  }

  if (tests.length === 0) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Regressions</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No regression tests yet. Regression tests are auto-generated when the system detects repeated production failures.</p>
      </div>
    </div>
  );

  const counts = {
    passing: tests.filter((t) => t.status === "passing").length,
    failing: tests.filter((t) => t.status === "failing").length,
    generated: tests.filter((t) => t.status === "generated").length,
    pending: tests.filter((t) => t.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Regressions</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Auto-generated regression tests from production error traces.
        </p>
      </div>

      {/* Summary counters */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded border border-white/10 px-3 py-1.5">
          Total: {tests.length}
        </span>
        <span className="rounded border border-[#3dffc0]/20 px-3 py-1.5 text-[#3dffc0]">
          Passing: {counts.passing}
        </span>
        <span className="rounded border border-[#ef4444]/20 px-3 py-1.5 text-[#ef4444]">
          Failing: {counts.failing}
        </span>
        <span className="rounded border border-blue-400/20 px-3 py-1.5 text-blue-400">
          Generated: {counts.generated}
        </span>
        <span className="rounded border border-white/10 px-3 py-1.5 text-[#f0f0f0]/50">
          Pending: {counts.pending}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-[#f0f0f0]/50">
              <th className="px-4 py-3">Source Trace</th>
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3">Error Pattern</th>
              <th className="px-4 py-3">Test File</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Created</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((reg) => {
              const badge = statusBadge(reg.status);
              return (
                <tr
                  key={reg.id}
                  className={`border-b border-white/5 transition-colors ${
                    reg.status === "failing"
                      ? "bg-[#ef4444]/[0.03] hover:bg-[#ef4444]/[0.06]"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dev-kit/sessions/${reg.sourceTraceId}`}
                      className="text-[#3dffc0] hover:underline font-mono text-xs"
                    >
                      {reg.sourceTraceId}
                    </Link>
                    <p className="text-xs text-[#f0f0f0]/40 mt-0.5">
                      {reg.sourceSessionName}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#f0f0f0]/70">
                    {reg.toolName}
                  </td>
                  <td className="px-4 py-3 text-[#f0f0f0]/60 text-xs max-w-xs truncate">
                    {reg.errorPattern}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {reg.testFilePath ? (
                      <span className="font-mono text-[#f0f0f0]/60">
                        {reg.testFilePath}
                      </span>
                    ) : (
                      <span className="text-[#f0f0f0]/30">
                        Not yet generated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#f0f0f0]/50 text-xs">
                    {formatDate(reg.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
