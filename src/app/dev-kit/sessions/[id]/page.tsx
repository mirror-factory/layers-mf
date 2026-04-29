/**
 * Trace Detail Page  --  /dev-kit/sessions/[id]
 * ==============================================
 * Shows the full trace for a single AI session. Top section is a colored
 * timeline bar with proportional-width segments per step:
 *   - White segments  = agent / user steps
 *   - Mint segments   = tool calls
 *   - Red segments    = errors
 * Hovering a segment shows step name + duration.
 *
 * Below the timeline is a step-by-step breakdown table with columns for
 * step type, content preview, cumulative token count, timing, and status.
 * Clicking a row expands a detail panel showing full input/output text,
 * token breakdown, cost, latency, tool args, error message, trace/span IDs.
 *
 * Fetches live data from /api/dev-kit/sessions/{id}; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepType = "user" | "agent" | "tool" | "error";

interface TraceStep {
  id: string;
  type: StepType;
  name: string;
  contentPreview: string;
  fullInput: string;
  fullOutput: string;
  tokensInput: number;
  tokensOutput: number;
  cumulativeTokens: number;
  cost: number;
  durationMs: number;
  status: "ok" | "error";
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  errorMessage?: string;
  traceId: string;
  spanId: string;
}

interface TraceData {
  sessionId: string;
  sessionName: string;
  model: string;
  totalDurationMs: number;
  steps: TraceStep[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepColor(type: StepType): string {
  switch (type) {
    case "user":
      return "bg-[#f0f0f0]";
    case "agent":
      return "bg-[#f0f0f0]/70";
    case "tool":
      return "bg-[#3dffc0]";
    case "error":
      return "bg-[#ef4444]";
  }
}

function stepColorLabel(type: StepType): string {
  switch (type) {
    case "user":
      return "text-[#f0f0f0]";
    case "agent":
      return "text-[#f0f0f0]";
    case "tool":
      return "text-[#3dffc0]";
    case "error":
      return "text-[#ef4444]";
  }
}

function formatDuration(ms: number): string {
  if (ms === 0) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TraceDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/dev-kit/sessions/${sessionId}`)
      .then(r => r.json())
      .then(d => { setTrace(d); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [sessionId]);

  if (loading || !trace) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading trace...
      </div>
    );
  }

  // Compute proportional widths based on duration (use 1ms minimum so zero-duration steps are visible)
  const durationsWithMin = trace.steps.map((s) => Math.max(s.durationMs, 80));
  const totalForBar = durationsWithMin.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/dev-kit/sessions"
          className="text-sm text-[#3dffc0] hover:underline"
        >
          &larr; Sessions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{trace.sessionName}</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          {trace.model} &middot; {formatDuration(trace.totalDurationMs)} total
          &middot; Session {trace.sessionId}
        </p>
      </div>

      {/* Timeline bar */}
      <div>
        <h2 className="text-sm font-medium text-[#f0f0f0]/60 mb-2">
          Timeline
        </h2>
        <div className="relative flex h-8 rounded overflow-hidden border border-white/10">
          {trace.steps.map((step, idx) => {
            const widthPct = (durationsWithMin[idx] / totalForBar) * 100;
            return (
              <div
                key={step.id}
                className={`relative ${stepColor(step.type)} transition-opacity cursor-pointer`}
                style={{ width: `${widthPct}%`, minWidth: "4px" }}
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() =>
                  setExpandedStep(expandedStep === step.id ? null : step.id)
                }
              >
                {/* Hover tooltip */}
                {hoveredStep === step.id && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap rounded bg-[#050505] border border-white/20 px-3 py-1.5 text-xs text-[#f0f0f0] shadow-lg">
                    <p className="font-medium">{step.name}</p>
                    <p className="text-[#f0f0f0]/60">
                      {formatDuration(step.durationMs)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-2 text-xs text-[#f0f0f0]/50">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded bg-[#f0f0f0]" />
            User / Agent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded bg-[#3dffc0]" />
            Tool Call
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded bg-[#ef4444]" />
            Error
          </span>
        </div>
      </div>

      {/* Step-by-step breakdown */}
      <div>
        <h2 className="text-sm font-medium text-[#f0f0f0]/60 mb-2">Steps</h2>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-[#f0f0f0]/50">
                <th className="px-4 py-3 w-8">#</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Content</th>
                <th className="px-4 py-3 text-right">Tokens (cum.)</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {trace.steps.map((step, idx) => (
                <>
                  <tr
                    key={step.id}
                    className={`border-b border-white/5 cursor-pointer transition-colors ${
                      step.status === "error"
                        ? "bg-[#ef4444]/5 hover:bg-[#ef4444]/10"
                        : "hover:bg-white/[0.03]"
                    }`}
                    onClick={() =>
                      setExpandedStep(
                        expandedStep === step.id ? null : step.id,
                      )
                    }
                  >
                    <td className="px-4 py-3 text-[#f0f0f0]/40 font-mono text-xs">
                      {idx + 1}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${stepColorLabel(step.type)}`}
                    >
                      {step.type === "tool" ? step.toolName : step.type}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f0]/70 max-w-md truncate">
                      {step.contentPreview}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {step.cumulativeTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {formatDuration(step.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {step.status === "ok" ? (
                        <span className="text-[#3dffc0] text-xs">OK</span>
                      ) : (
                        <span className="text-[#ef4444] text-xs">ERR</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail panel */}
                  {expandedStep === step.id && (
                    <tr key={`${step.id}-detail`}>
                      <td
                        colSpan={6}
                        className="bg-white/[0.02] border-b border-white/10"
                      >
                        <div className="px-6 py-5 space-y-4">
                          {/* Input / Output */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                                Input
                              </p>
                              <pre className="text-xs bg-[#050505] border border-white/10 rounded p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {step.fullInput || "(none)"}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                                Output
                              </p>
                              <pre className="text-xs bg-[#050505] border border-white/10 rounded p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {step.fullOutput || "(none)"}
                              </pre>
                            </div>
                          </div>

                          {/* Metrics row */}
                          <div className="flex flex-wrap gap-6 text-xs">
                            <div>
                              <span className="text-[#f0f0f0]/50">
                                Input tokens:{" "}
                              </span>
                              <span className="font-mono">
                                {step.tokensInput}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#f0f0f0]/50">
                                Output tokens:{" "}
                              </span>
                              <span className="font-mono">
                                {step.tokensOutput}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#f0f0f0]/50">Cost: </span>
                              <span className="font-mono">
                                ${step.cost.toFixed(4)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#f0f0f0]/50">
                                Latency:{" "}
                              </span>
                              <span className="font-mono">
                                {formatDuration(step.durationMs)}
                              </span>
                            </div>
                          </div>

                          {/* Tool info */}
                          {step.toolName && (
                            <div className="text-xs">
                              <span className="text-[#f0f0f0]/50">
                                Tool:{" "}
                              </span>
                              <span className="text-[#3dffc0] font-mono">
                                {step.toolName}
                              </span>
                              {step.toolArgs && (
                                <pre className="mt-1 bg-[#050505] border border-white/10 rounded p-2 whitespace-pre-wrap">
                                  {JSON.stringify(step.toolArgs, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}

                          {/* Error message */}
                          {step.errorMessage && (
                            <div className="text-xs">
                              <span className="text-[#ef4444] font-medium">
                                Error:{" "}
                              </span>
                              <span className="text-[#ef4444]/80">
                                {step.errorMessage}
                              </span>
                            </div>
                          )}

                          {/* Trace / Span IDs */}
                          <div className="flex gap-6 text-xs text-[#f0f0f0]/40 font-mono">
                            <span>trace: {step.traceId}</span>
                            <span>span: {step.spanId}</span>
                          </div>
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
    </div>
  );
}
