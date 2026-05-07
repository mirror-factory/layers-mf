/**
 * Eval Run Detail Page  --  /dev-kit/evals/[id]
 * ===============================================
 * Shows the per-test-case breakdown for a single evaluation run.
 *
 * Header section: suite name, run date, provider, model, overall pass rate.
 * Case-by-case table: name, status badge, input (truncated), expected,
 * actual, score, duration. Failed cases are highlighted with a red border.
 * Clicking a failed case expands a side-by-side diff view (expected vs actual).
 * Each case links to its trace when a trace_id exists.
 * Back-link to /dev-kit/evals.
 *
 * Spec item #131.
 *
 * Fetches live data from /api/dev-kit/evals/{id}; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalCase {
  id: string;
  name: string;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  score: number;
  durationMs: number;
  traceId?: string;
}

interface EvalRunDetail {
  id: string;
  suiteName: string;
  runDate: string;
  provider: string;
  model: string;
  passRate: number;
  cases: EvalCase[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function passRateColor(rate: number): string {
  if (rate >= 90) return "text-[#3dffc0]";
  if (rate >= 70) return "text-yellow-400";
  return "text-[#ef4444]";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EvalRunDetailPage() {
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<EvalRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/dev-kit/evals/${runId}`)
      .then(r => r.json())
      .then(d => { setRun(d); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [runId]);

  if (loading || !run) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading eval run...
      </div>
    );
  }

  const totalCases = run.cases.length;
  const passedCases = run.cases.filter((c) => c.passed).length;
  const failedCases = totalCases - passedCases;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div>
        <Link
          href="/dev-kit/evals"
          className="text-sm text-[#3dffc0] hover:underline"
        >
          &larr; Evaluations
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-6 py-5">
        <h1 className="text-2xl font-semibold">{run.suiteName}</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Run ID: {run.id}
        </p>

        <div className="mt-4 flex flex-wrap gap-8 text-sm">
          {/* Run date */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/40 mb-0.5">
              Run Date
            </p>
            <p className="font-mono">{formatDate(run.runDate)}</p>
          </div>

          {/* Provider */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/40 mb-0.5">
              Provider
            </p>
            <p className="font-mono">{run.provider}</p>
          </div>

          {/* Model */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/40 mb-0.5">
              Model
            </p>
            <p className="font-mono text-[#f0f0f0]/80">{run.model}</p>
          </div>

          {/* Pass rate */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/40 mb-0.5">
              Pass Rate
            </p>
            <p className={`font-mono font-semibold ${passRateColor(run.passRate)}`}>
              {run.passRate.toFixed(1)}%
            </p>
          </div>

          {/* Case counts */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/40 mb-0.5">
              Cases
            </p>
            <p className="font-mono">
              <span className="text-[#3dffc0]">{passedCases} passed</span>
              {failedCases > 0 && (
                <>
                  {" / "}
                  <span className="text-[#ef4444]">{failedCases} failed</span>
                </>
              )}
              {" / "}
              {totalCases} total
            </p>
          </div>
        </div>
      </div>

      {/* Case-by-case table */}
      <div>
        <h2 className="text-sm font-medium text-[#f0f0f0]/60 mb-2">
          Test Cases
        </h2>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-[#f0f0f0]/50">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Input</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Actual</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-center">Trace</th>
              </tr>
            </thead>
            <tbody>
              {run.cases.map((c) => (
                <>
                  <tr
                    key={c.id}
                    className={`border-b cursor-pointer transition-colors ${
                      !c.passed
                        ? "border-[#ef4444]/30 bg-[#ef4444]/5 hover:bg-[#ef4444]/10"
                        : "border-white/5 hover:bg-white/[0.03]"
                    }`}
                    onClick={() =>
                      setExpandedCase(
                        expandedCase === c.id ? null : c.id,
                      )
                    }
                  >
                    <td className="px-4 py-3 text-[#f0f0f0]/80 font-medium">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.passed ? (
                        <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-[#3dffc0]/10 text-[#3dffc0] border border-[#3dffc0]/20">
                          PASS
                        </span>
                      ) : (
                        <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">
                          FAIL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f0]/60 text-xs max-w-[160px] truncate">
                      {truncate(c.input, 60)}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f0]/60 text-xs max-w-[160px] truncate">
                      {truncate(c.expected, 60)}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f0]/60 text-xs max-w-[160px] truncate">
                      {truncate(c.actual, 60)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <span
                        className={
                          c.score >= 80
                            ? "text-[#3dffc0]"
                            : c.score >= 60
                              ? "text-yellow-400"
                              : "text-[#ef4444]"
                        }
                      >
                        {c.score}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#f0f0f0]/60">
                      {formatDuration(c.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.traceId ? (
                        <Link
                          href={`/dev-kit/sessions/${c.traceId}`}
                          className="text-[#3dffc0] text-xs hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          view
                        </Link>
                      ) : (
                        <span className="text-[#f0f0f0]/20 text-xs">--</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded: side-by-side diff view for failed cases */}
                  {expandedCase === c.id && (
                    <tr key={`${c.id}-detail`}>
                      <td
                        colSpan={8}
                        className={`bg-white/[0.02] ${
                          !c.passed
                            ? "border-l-2 border-l-[#ef4444]"
                            : "border-b border-white/10"
                        }`}
                      >
                        <div className="px-6 py-5 space-y-4">
                          {/* Full input */}
                          <div>
                            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                              Input
                            </p>
                            <pre className="text-xs bg-[#050505] border border-white/10 rounded p-3 whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {c.input}
                            </pre>
                          </div>

                          {/* Side-by-side: Expected vs Actual */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                                Expected
                              </p>
                              <pre
                                className={`text-xs rounded p-3 whitespace-pre-wrap max-h-48 overflow-y-auto ${
                                  !c.passed
                                    ? "bg-[#3dffc0]/5 border border-[#3dffc0]/20"
                                    : "bg-[#050505] border border-white/10"
                                }`}
                              >
                                {c.expected}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                                Actual
                              </p>
                              <pre
                                className={`text-xs rounded p-3 whitespace-pre-wrap max-h-48 overflow-y-auto ${
                                  !c.passed
                                    ? "bg-[#ef4444]/5 border border-[#ef4444]/20"
                                    : "bg-[#050505] border border-white/10"
                                }`}
                              >
                                {c.actual}
                              </pre>
                            </div>
                          </div>

                          {/* Metrics row */}
                          <div className="flex flex-wrap gap-6 text-xs">
                            <div>
                              <span className="text-[#f0f0f0]/50">Score: </span>
                              <span
                                className={`font-mono font-semibold ${
                                  c.score >= 80
                                    ? "text-[#3dffc0]"
                                    : c.score >= 60
                                      ? "text-yellow-400"
                                      : "text-[#ef4444]"
                                }`}
                              >
                                {c.score}%
                              </span>
                            </div>
                            <div>
                              <span className="text-[#f0f0f0]/50">Duration: </span>
                              <span className="font-mono">
                                {formatDuration(c.durationMs)}
                              </span>
                            </div>
                            {c.traceId && (
                              <div>
                                <span className="text-[#f0f0f0]/50">Trace: </span>
                                <Link
                                  href={`/dev-kit/sessions/${c.traceId}`}
                                  className="text-[#3dffc0] font-mono hover:underline"
                                >
                                  {c.traceId}
                                </Link>
                              </div>
                            )}
                          </div>

                          {/* Failure indicator for failed cases */}
                          {!c.passed && (
                            <div className="text-xs">
                              <span className="text-[#ef4444] font-medium">
                                FAILED:{" "}
                              </span>
                              <span className="text-[#ef4444]/80">
                                Output does not match expected criteria. Score {c.score}% is below the passing threshold.
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between text-xs text-[#f0f0f0]/40">
        <p>
          {totalCases} test case{totalCases !== 1 ? "s" : ""} --{" "}
          <span className="text-[#3dffc0]">{passedCases} passed</span>
          {failedCases > 0 && (
            <>
              {", "}
              <span className="text-[#ef4444]">{failedCases} failed</span>
            </>
          )}
        </p>
        <Link
          href="/dev-kit/evals"
          className="text-[#3dffc0] hover:underline"
        >
          &larr; Back to Evaluations
        </Link>
      </div>
    </div>
  );
}
