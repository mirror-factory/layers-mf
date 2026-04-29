/**
 * Evaluations Page  --  /dev-kit/evals
 * =====================================
 * Displays all evaluation suites with trending information. Each suite
 * shows its name, last run date, pass rate with trend arrow, total test
 * cases, and the provider used.
 *
 * Clicking a suite expands to show the individual run detail with
 * per-case pass/fail breakdown.
 *
 * Fetches live data from /api/dev-kit/evals; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalCase {
  name: string;
  passed: boolean;
  score: number;
  durationMs: number;
}

interface EvalSuite {
  id: string;
  name: string;
  lastRunDate: string;
  passRate: number;
  passRateTrend: number; // percentage change vs prior run
  totalCases: number;
  provider: string;
  cases: EvalCase[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trendArrow(trend: number): string {
  if (trend > 0) return `^ +${trend.toFixed(1)}%`;
  if (trend < 0) return `v ${trend.toFixed(1)}%`;
  return "-- 0%";
}

function trendColor(trend: number): string {
  if (trend > 0) return "text-[#3dffc0]";
  if (trend < 0) return "text-[#ef4444]";
  return "text-[#f0f0f0]/40";
}

function passRateColor(rate: number): string {
  if (rate >= 90) return "text-[#3dffc0]";
  if (rate >= 70) return "text-yellow-400";
  return "text-[#ef4444]";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EvalsPage() {
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dev-kit/evals')
      .then(r => r.json())
      .then(d => { setSuites(Array.isArray(d) ? d : d.data ?? []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading evaluations...
      </div>
    );
  }

  if (suites.length === 0) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Evaluations</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No evaluations run yet. Run npx promptfoo eval to execute your first evaluation suite.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Evaluations</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Evaluation suites, pass rates, and trending over time.
        </p>
      </div>

      {/* Suite list */}
      <div className="space-y-3">
        {suites.map((suite) => (
          <div
            key={suite.id}
            className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden"
          >
            {/* Suite header row */}
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
              onClick={() =>
                setExpandedSuite(
                  expandedSuite === suite.id ? null : suite.id,
                )
              }
            >
              <div className="flex items-center gap-6 flex-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{suite.name}</p>
                  <p className="text-xs text-[#f0f0f0]/40 mt-0.5">
                    Last run: {suite.lastRunDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8 text-sm shrink-0">
                {/* Pass rate + trend */}
                <div className="text-right">
                  <p className={`font-mono font-semibold ${passRateColor(suite.passRate)}`}>
                    {suite.passRate.toFixed(1)}%
                  </p>
                  <p className={`text-xs font-mono ${trendColor(suite.passRateTrend)}`}>
                    {trendArrow(suite.passRateTrend)}
                  </p>
                </div>

                {/* Total cases */}
                <div className="text-right w-16">
                  <p className="font-mono">{suite.totalCases}</p>
                  <p className="text-xs text-[#f0f0f0]/40">cases</p>
                </div>

                {/* Provider */}
                <div className="text-right w-40">
                  <p className="font-mono text-xs text-[#f0f0f0]/60 truncate">
                    {suite.provider}
                  </p>
                </div>

                {/* Expand indicator */}
                <span className="text-[#f0f0f0]/40 text-xs w-4">
                  {expandedSuite === suite.id ? "[-]" : "[+]"}
                </span>
              </div>
            </div>

            {/* Expanded: per-case breakdown */}
            {expandedSuite === suite.id && (
              <div className="border-t border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[#f0f0f0]/40">
                      <th className="px-5 py-2">Case</th>
                      <th className="px-5 py-2 text-center">Result</th>
                      <th className="px-5 py-2 text-right">Score</th>
                      <th className="px-5 py-2 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suite.cases.map((c) => (
                      <tr
                        key={c.name}
                        className={`border-t border-white/5 ${
                          !c.passed ? "bg-[#ef4444]/5" : ""
                        }`}
                      >
                        <td className="px-5 py-2 text-[#f0f0f0]/80">
                          {c.name}
                        </td>
                        <td className="px-5 py-2 text-center">
                          {c.passed ? (
                            <span className="text-[#3dffc0] text-xs font-medium">
                              PASS
                            </span>
                          ) : (
                            <span className="text-[#ef4444] text-xs font-medium">
                              FAIL
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-2 text-right font-mono text-xs">
                          {c.score}%
                        </td>
                        <td className="px-5 py-2 text-right font-mono text-xs text-[#f0f0f0]/60">
                          {c.durationMs < 1000
                            ? `${c.durationMs}ms`
                            : `${(c.durationMs / 1000).toFixed(1)}s`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
