/**
 * Tool Registry Browser  --  /dev-kit/tools
 * ==========================================
 * Displays all registered AI tools in a searchable table. Columns include
 * tool name, description (truncated), category, permission tier (explorer /
 * executor badges), test status (passing / failing / untested), last eval
 * score, and estimated cost per invocation.
 *
 * Clicking a row expands a detail panel showing the full JSON schema,
 * links to test files, and evaluation history.
 *
 * Fetches live data from /api/dev-kit/tools; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermissionTier = "explorer" | "executor";
type TestStatus = "passing" | "failing" | "untested";

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  permissionTier: PermissionTier;
  testStatus: TestStatus;
  lastEvalScore: number | null; // 0-100 or null if never evaluated
  costEstimate: string; // e.g. "$0.002/call"
  schema: Record<string, unknown>;
  testFilePath: string | null;
  evalHistory: { date: string; score: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tierBadge(tier: PermissionTier): string {
  if (tier === "explorer") return "bg-[#3dffc0]/15 text-[#3dffc0]";
  return "bg-yellow-400/15 text-yellow-400";
}

function testStatusBadge(status: TestStatus): { className: string; label: string } {
  switch (status) {
    case "passing":
      return { className: "bg-[#3dffc0]/15 text-[#3dffc0]", label: "passing" };
    case "failing":
      return { className: "bg-[#ef4444]/15 text-[#ef4444]", label: "failing" };
    case "untested":
      return { className: "bg-white/10 text-[#f0f0f0]/50", label: "untested" };
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dev-kit/tools')
      .then(r => r.json())
      .then(d => { setTools(Array.isArray(d) ? d : d.data ?? []); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading tools...
      </div>
    );
  }

  if (tools.length === 0) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Tool Registry</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No tools registered. Run ai-dev-kit tool add &lt;name&gt; to create your first tool, or check that lib/ai/tools/_metadata.ts exists.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Tool Registry</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Browse all registered AI tools, their schemas, test status, and evaluation scores.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-[#f0f0f0]/50">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Permission</th>
              <th className="px-4 py-3">Test Status</th>
              <th className="px-4 py-3 text-right">Eval Score</th>
              <th className="px-4 py-3 text-right">Cost Est.</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => {
              const tsb = testStatusBadge(tool.testStatus);
              return (
                <>
                  <tr
                    key={tool.id}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedTool(expandedTool === tool.id ? null : tool.id)
                    }
                  >
                    <td className="px-4 py-3 font-mono text-[#3dffc0]">
                      {tool.name}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f0]/70 max-w-xs">
                      {truncate(tool.description, 60)}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f0]/60 text-xs">
                      {tool.category}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tierBadge(tool.permissionTier)}`}
                      >
                        {tool.permissionTier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tsb.className}`}
                      >
                        {tsb.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {tool.lastEvalScore !== null
                        ? `${tool.lastEvalScore}%`
                        : "--"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#f0f0f0]/60">
                      {tool.costEstimate}
                    </td>
                  </tr>

                  {/* Expanded detail panel */}
                  {expandedTool === tool.id && (
                    <tr key={`${tool.id}-detail`}>
                      <td
                        colSpan={7}
                        className="bg-white/[0.02] border-b border-white/10"
                      >
                        <div className="px-6 py-5 space-y-4">
                          {/* Full description */}
                          <div>
                            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                              Full Description
                            </p>
                            <p className="text-sm text-[#f0f0f0]/80">
                              {tool.description}
                            </p>
                          </div>

                          {/* Schema */}
                          <div>
                            <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                              Schema
                            </p>
                            <pre className="text-xs bg-[#050505] border border-white/10 rounded p-3 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                              {JSON.stringify(tool.schema, null, 2)}
                            </pre>
                          </div>

                          {/* Test file */}
                          <div className="text-xs">
                            <span className="text-[#f0f0f0]/50">
                              Test file:{" "}
                            </span>
                            {tool.testFilePath ? (
                              <span className="font-mono text-[#3dffc0]">
                                {tool.testFilePath}
                              </span>
                            ) : (
                              <span className="text-[#f0f0f0]/30">
                                No test file
                              </span>
                            )}
                          </div>

                          {/* Eval history */}
                          {tool.evalHistory.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-wider text-[#f0f0f0]/50 mb-1">
                                Eval History
                              </p>
                              <div className="flex gap-4">
                                {tool.evalHistory.map((entry) => (
                                  <div
                                    key={entry.date}
                                    className="text-xs border border-white/10 rounded px-3 py-2"
                                  >
                                    <p className="text-[#f0f0f0]/50">
                                      {entry.date}
                                    </p>
                                    <p className="font-mono text-sm">
                                      {entry.score}%
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
