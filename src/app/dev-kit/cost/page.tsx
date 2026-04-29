/**
 * Cost Dashboard  --  /dev-kit/cost
 * ==================================
 * Real-time cost tracking and budget monitoring. Shows:
 *   - Spend vs budget gauge (circular SVG progress ring)
 *   - Per-model cost breakdown (CSS bar chart)
 *   - Cost over time (SVG line chart)
 *   - Budget utilization indicator with color thresholds:
 *       green < 50%, yellow 50-80%, red > 80%
 *
 * No external chart libraries -- pure CSS and inline SVG.
 *
 * Fetches live data from /api/dev-kit/cost; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CostData {
  budget: number;
  spent: number;
  period: string; // e.g. "April 2026"
  perModel: { model: string; cost: number }[];
  byModel?: { model: string; cost: number }[];
  overTime: { date: string; cost: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utilizationColor(pct: number): string {
  if (pct < 50) return "#3dffc0";
  if (pct < 80) return "#eab308"; // yellow
  return "#ef4444";
}

function utilizationLabel(pct: number): string {
  if (pct < 50) return "On Track";
  if (pct < 80) return "Caution";
  return "Over Budget Risk";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Circular SVG gauge showing spend vs budget */
function BudgetGauge({ spent, budget }: { spent: number; budget: number }) {
  const pct = Math.min((spent / budget) * 100, 100);
  const color = utilizationColor(pct);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="180" height="180" viewBox="0 0 180 180">
        {/* Background ring */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="rgba(240,240,240,0.08)"
          strokeWidth="12"
        />
        {/* Progress ring */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Center text */}
        <text
          x="90"
          y="82"
          textAnchor="middle"
          fill="#f0f0f0"
          fontSize="24"
          fontWeight="600"
          fontFamily="monospace"
        >
          {pct.toFixed(0)}%
        </text>
        <text
          x="90"
          y="104"
          textAnchor="middle"
          fill="rgba(240,240,240,0.5)"
          fontSize="11"
        >
          ${spent.toFixed(2)} / ${budget}
        </text>
      </svg>
      <div className="text-center">
        <p
          className="text-sm font-medium"
          style={{ color }}
        >
          {utilizationLabel(pct)}
        </p>
        <p className="text-xs text-[#f0f0f0]/40 mt-0.5">
          Budget utilization
        </p>
      </div>
    </div>
  );
}

/** Horizontal bar chart for per-model costs */
function ModelBarChart({
  perModel,
}: {
  perModel: CostData["perModel"];
}) {
  const max = Math.max(...perModel.map((m) => m.cost));

  return (
    <div className="space-y-3">
      {perModel.map((entry) => {
        const widthPct = (entry.cost / max) * 100;
        return (
          <div key={entry.model}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono text-[#f0f0f0]/70 truncate max-w-[200px]">
                {entry.model}
              </span>
              <span className="font-mono text-[#f0f0f0]/90">
                ${entry.cost.toFixed(2)}
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#3dffc0] transition-all duration-500"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Simple SVG line chart for cost over time */
function CostLineChart({
  overTime,
  budget,
}: {
  overTime: CostData["overTime"];
  budget: number;
}) {
  if (overTime.length < 2) return null;

  const chartW = 600;
  const chartH = 200;
  const padX = 40;
  const padY = 20;

  const maxCost = Math.max(budget, ...overTime.map((d) => d.cost));
  const xStep = (chartW - padX * 2) / (overTime.length - 1);

  const points = overTime.map((d, i) => ({
    x: padX + i * xStep,
    y: padY + (1 - d.cost / maxCost) * (chartH - padY * 2),
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Budget line y position
  const budgetY = padY + (1 - budget / maxCost) * (chartH - padY * 2);

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = padY + (1 - pct) * (chartH - padY * 2);
        return (
          <g key={pct}>
            <line
              x1={padX}
              y1={y}
              x2={chartW - padX}
              y2={y}
              stroke="rgba(240,240,240,0.06)"
              strokeWidth="1"
            />
            <text
              x={padX - 6}
              y={y + 3}
              textAnchor="end"
              fill="rgba(240,240,240,0.3)"
              fontSize="9"
              fontFamily="monospace"
            >
              ${(maxCost * pct).toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Budget line */}
      <line
        x1={padX}
        y1={budgetY}
        x2={chartW - padX}
        y2={budgetY}
        stroke="#ef4444"
        strokeWidth="1"
        strokeDasharray="6 4"
      />
      <text
        x={chartW - padX + 4}
        y={budgetY + 3}
        fill="#ef4444"
        fontSize="9"
        fontFamily="monospace"
      >
        Budget
      </text>

      {/* Cost line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#3dffc0"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="#3dffc0"
        />
      ))}

      {/* X-axis labels */}
      {overTime.map((d, i) => (
        <text
          key={d.date}
          x={points[i].x}
          y={chartH - 4}
          textAnchor="middle"
          fill="rgba(240,240,240,0.3)"
          fontSize="8"
          fontFamily="monospace"
        >
          {d.date}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CostPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-kit/cost')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#f0f0f0]/40">
        Loading cost data...
      </div>
    );
  }

  if (!data) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Cost</h1>
      <div className="border border-[#3dffc0]/20 rounded p-6 text-center" style={{background:'rgba(61,255,192,.03)'}}>
        <p className="text-[#f0f0f0]/60 text-sm">No cost data yet. Costs are tracked automatically with each AI call when TelemetryIntegration is active.</p>
      </div>
    </div>
  );

  const spent = data.spent ?? 0;
  const budget = data.budget ?? 1;
  const utilizationPct = (spent / budget) * 100;
  const overTime = data.overTime ?? [];
  const byModel = data.perModel ?? data.byModel ?? [];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Cost</h1>
        <p className="mt-1 text-sm text-[#f0f0f0]/50">
          Spend tracking and budget monitoring for {data.period ?? 'current period'}.
        </p>
      </div>

      {/* Top row: Gauge + Bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Budget gauge */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 flex items-center justify-center">
          <BudgetGauge spent={spent} budget={budget} />
        </div>

        {/* Per-model breakdown */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-sm font-medium text-[#f0f0f0]/60 mb-4">
            Cost by Model
          </h2>
          <ModelBarChart perModel={byModel} />
        </div>
      </div>

      {/* Cost over time */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium text-[#f0f0f0]/60 mb-4">
          Cost Over Time
        </h2>
        <CostLineChart overTime={overTime} budget={budget} />
      </div>

      {/* Budget utilization summary */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Budget Utilization</p>
          <p className="text-xs text-[#f0f0f0]/50 mt-0.5">
            ${spent.toFixed(2)} of ${budget.toFixed(2)} ({utilizationPct.toFixed(1)}%)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48 h-3 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(utilizationPct, 100)}%`,
                backgroundColor: utilizationColor(utilizationPct),
              }}
            />
          </div>
          <span
            className="text-xs font-medium"
            style={{ color: utilizationColor(utilizationPct) }}
          >
            {utilizationLabel(utilizationPct)}
          </span>
        </div>
      </div>
    </div>
  );
}
