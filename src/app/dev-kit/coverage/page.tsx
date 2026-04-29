/**
 * Test Coverage Map  --  /dev-kit/coverage
 * =========================================
 * Grid view of all registered tools with coverage indicators. For each
 * tool the grid shows:
 *   - Tool name
 *   - Has unit tests  (checkmark or gap)
 *   - Has eval cases  (checkmark or gap)
 *   - Tested in production (checkmark or gap)
 * Gaps (missing coverage) are highlighted to surface risk at a glance.
 *
 * Fetches live data from /api/dev-kit/coverage; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolCoverage {
  id: string;
  name: string;
  category: string;
  hasUnitTests: boolean;
  hasEvalCases: boolean;
  testedInProduction: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coverageLevel(tool: ToolCoverage): {
  score: number;
  label: string;
  color: string;
} {
  const flags = [tool.hasUnitTests, tool.hasEvalCases, tool.testedInProduction];
  const count = flags.filter(Boolean).length;
  if (count === 3) return { score: 3, label: "Full", color: "text-[#3dffc0]" };
  if (count === 2) return { score: 2, label: "Partial", color: "text-yellow-400" };
  if (count === 1) return { score: 1, label: "Minimal", color: "text-yellow-400" };
  return { score: 0, label: "None", color: "text-[#ef4444]" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoveragePage() {
  const [tools, setTools] = useState<ToolCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-kit/coverage')
      .then(r => r.json())
      .then(d => { setTools(Array.isArray(d) ? d : d.data ?? []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading coverage data...
      </div>
    );
  }

  if (tools.length === 0) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Coverage</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No coverage data. Coverage maps are generated from your tool registry and test files.</p>
      </div>
    </div>
  );

  const fullCt = tools.filter((t) => coverageLevel(t).score === 3).length;
  const gapCt = tools.length - fullCt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Coverage</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Test and eval coverage across all registered tools.
        </p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded border border-white/10 px-3 py-1.5">
          Tools: {tools.length}
        </span>
        <span className="rounded border border-[#3dffc0]/20 px-3 py-1.5 text-[#3dffc0]">
          Full coverage: {fullCt}
        </span>
        <span className="rounded border border-[#ef4444]/20 px-3 py-1.5 text-[#ef4444]">
          With gaps: {gapCt}
        </span>
      </div>

      {/* Coverage grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {tools.map((tool) => {
          const level = coverageLevel(tool);
          const hasGap =
            !tool.hasUnitTests ||
            !tool.hasEvalCases ||
            !tool.testedInProduction;

          return (
            <div
              key={tool.id}
              className={`rounded-lg border p-4 ${
                hasGap
                  ? "border-[#ef4444]/20 bg-[#ef4444]/[0.02]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {/* Tool name */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-mono text-sm text-[#3dffc0]">
                    {tool.name}
                  </p>
                  <p className="text-xs text-[#f0f0f0]/40">{tool.category}</p>
                </div>
                <span className={`text-xs font-medium ${level.color}`}>
                  {level.label}
                </span>
              </div>

              {/* Checkmarks */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {tool.hasUnitTests ? (
                    <span className="text-[#3dffc0] font-mono w-4 text-center">
                      [x]
                    </span>
                  ) : (
                    <span className="text-[#ef4444] font-mono w-4 text-center">
                      [ ]
                    </span>
                  )}
                  <span
                    className={
                      tool.hasUnitTests
                        ? "text-[#f0f0f0]/70"
                        : "text-[#ef4444]/70"
                    }
                  >
                    Unit tests
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {tool.hasEvalCases ? (
                    <span className="text-[#3dffc0] font-mono w-4 text-center">
                      [x]
                    </span>
                  ) : (
                    <span className="text-[#ef4444] font-mono w-4 text-center">
                      [ ]
                    </span>
                  )}
                  <span
                    className={
                      tool.hasEvalCases
                        ? "text-[#f0f0f0]/70"
                        : "text-[#ef4444]/70"
                    }
                  >
                    Eval cases
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {tool.testedInProduction ? (
                    <span className="text-[#3dffc0] font-mono w-4 text-center">
                      [x]
                    </span>
                  ) : (
                    <span className="text-[#ef4444] font-mono w-4 text-center">
                      [ ]
                    </span>
                  )}
                  <span
                    className={
                      tool.testedInProduction
                        ? "text-[#f0f0f0]/70"
                        : "text-[#ef4444]/70"
                    }
                  >
                    Production tested
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table view (alternative view for accessibility) */}
      <div>
        <h2 className="text-sm font-medium text-[#f0f0f0]/60 mb-3">
          Detailed View
        </h2>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-[#f0f0f0]/50">
                <th className="px-4 py-3">Tool</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Unit Tests</th>
                <th className="px-4 py-3 text-center">Eval Cases</th>
                <th className="px-4 py-3 text-center">Prod Tested</th>
                <th className="px-4 py-3 text-center">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const level = coverageLevel(tool);
                return (
                  <tr
                    key={`table-${tool.id}`}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[#3dffc0]">
                      {tool.name}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f0]/60 text-xs">
                      {tool.category}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tool.hasUnitTests ? (
                        <span className="text-[#3dffc0] text-xs">[ok]</span>
                      ) : (
                        <span className="text-[#ef4444] text-xs">[gap]</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tool.hasEvalCases ? (
                        <span className="text-[#3dffc0] text-xs">[ok]</span>
                      ) : (
                        <span className="text-[#ef4444] text-xs">[gap]</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tool.testedInProduction ? (
                        <span className="text-[#3dffc0] text-xs">[ok]</span>
                      ) : (
                        <span className="text-[#ef4444] text-xs">[gap]</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-center text-xs font-medium ${level.color}`}
                    >
                      {level.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
