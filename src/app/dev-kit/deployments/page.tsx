/**
 * Deployments Timeline  --  /dev-kit/deployments
 * ================================================
 * Shows a chronological list of deployments. Each entry displays:
 *   - Commit hash (short)
 *   - Deployment date
 *   - Gate results: per-gate pass/fail badges (type-check, lint, tests,
 *     eval threshold, cost gate)
 *   - Eval snapshot: pass rate at deployment time
 *
 * Fetches live data from /api/dev-kit/deployments; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GateResult {
  name: string;
  passed: boolean;
}

interface Deployment {
  id: string;
  commitHash: string;
  commitMessage: string;
  date: string;
  gates: GateResult[];
  evalPassRate: number;
  status: "success" | "failed" | "pending";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusIndicator(status: Deployment["status"]): {
  color: string;
  label: string;
} {
  switch (status) {
    case "success":
      return { color: "text-[#3dffc0]", label: "DEPLOYED" };
    case "failed":
      return { color: "text-[#ef4444]", label: "BLOCKED" };
    case "pending":
      return { color: "text-yellow-400", label: "PENDING" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-kit/deployments')
      .then(r => r.json())
      .then(d => { setDeployments(Array.isArray(d) ? d : d.data ?? []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading deployments...
      </div>
    );
  }

  if (deployments.length === 0) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Deployments</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No deployments recorded. Run ai-dev-kit deploy validate to capture your first deployment snapshot.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Deployments</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Deployment history with gate results and eval snapshots.
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {deployments.map((deploy) => {
          const si = statusIndicator(deploy.status);
          const allPassed = deploy.gates.every((g) => g.passed);

          return (
            <div
              key={deploy.id}
              className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden"
            >
              <div className="px-5 py-4">
                {/* Top row: commit + status */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-[#3dffc0]">
                        {deploy.commitHash}
                      </span>
                      <span className={`text-xs font-medium ${si.color}`}>
                        {si.label}
                      </span>
                    </div>
                    <p className="text-sm text-[#f0f0f0]/70 mt-1 truncate">
                      {deploy.commitMessage}
                    </p>
                    <p className="text-xs text-[#f0f0f0]/40 mt-1">
                      {formatDate(deploy.date)}
                    </p>
                  </div>

                  {/* Eval snapshot */}
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[#f0f0f0]/50">Eval Pass Rate</p>
                    <p
                      className={`font-mono text-lg font-semibold ${
                        deploy.evalPassRate >= 90
                          ? "text-[#3dffc0]"
                          : deploy.evalPassRate >= 70
                            ? "text-yellow-400"
                            : "text-[#ef4444]"
                      }`}
                    >
                      {deploy.evalPassRate}%
                    </p>
                  </div>
                </div>

                {/* Gate badges */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {deploy.gates.map((gate) => (
                    <span
                      key={gate.name}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono ${
                        gate.passed
                          ? "bg-[#3dffc0]/10 text-[#3dffc0]"
                          : "bg-[#ef4444]/10 text-[#ef4444]"
                      }`}
                    >
                      {gate.passed ? "[ok]" : "[x]"} {gate.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom indicator bar */}
              <div
                className={`h-1 ${allPassed ? "bg-[#3dffc0]" : "bg-[#ef4444]"}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
