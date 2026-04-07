"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Loader2, X, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentItem {
  name: string;
  status: "pending" | "running" | "complete" | "error";
}

interface AgentSwarmProps {
  agents: AgentItem[];
  size?: number;
  className?: string;
  animated?: boolean;
}

const MINT = "#34d399";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clusterPositions(count: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const angle = i * GOLDEN_ANGLE;
    const dist = r * (0.2 + t * 0.6);
    positions.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    });
  }
  return positions;
}

function StatusIcon({ status }: { status: AgentItem["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />;
    case "complete":
      return <Check className="h-3.5 w-3.5 text-emerald-400" />;
    case "error":
      return <X className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <Circle className="h-3 w-3 text-zinc-600" />;
  }
}

export function AgentSwarm({
  agents: initialAgents,
  size = 36,
  className,
  animated = false,
}: AgentSwarmProps) {
  const [phase, setPhase] = useState<"idle" | "dispersing" | "running" | "completing" | "converging">(
    animated ? "idle" : "dispersing",
  );
  const [agents, setAgents] = useState<AgentItem[]>(initialAgents);
  const [dispersedCount, setDispersedCount] = useState(animated ? 0 : initialAgents.length);
  const [completedCount, setCompletedCount] = useState(0);

  const resetCycle = useCallback(() => {
    setPhase("idle");
    setDispersedCount(0);
    setCompletedCount(0);
    setAgents(initialAgents.map((a) => ({ ...a, status: "pending" })));
  }, [initialAgents]);

  useEffect(() => {
    if (!animated) {
      setAgents(initialAgents);
      setDispersedCount(initialAgents.length);
      return;
    }

    if (phase === "idle") {
      const t = setTimeout(() => setPhase("dispersing"), 1000);
      return () => clearTimeout(t);
    }

    if (phase === "dispersing") {
      if (dispersedCount < initialAgents.length) {
        const t = setTimeout(() => {
          setDispersedCount((c) => c + 1);
          setAgents((prev) =>
            prev.map((a, i) => (i === dispersedCount ? { ...a, status: "running" } : a)),
          );
        }, 200);
        return () => clearTimeout(t);
      }
      setPhase("running");
    }

    if (phase === "running") {
      const t = setTimeout(() => setPhase("completing"), 1000);
      return () => clearTimeout(t);
    }

    if (phase === "completing") {
      if (completedCount < initialAgents.length) {
        const t = setTimeout(() => {
          setCompletedCount((c) => c + 1);
          setAgents((prev) =>
            prev.map((a, i) => (i === completedCount ? { ...a, status: "complete" } : a)),
          );
        }, 200);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("converging"), 500);
      return () => clearTimeout(t);
    }

    if (phase === "converging") {
      setDispersedCount(0);
      const t = setTimeout(resetCycle, 800);
      return () => clearTimeout(t);
    }
  }, [phase, dispersedCount, completedCount, initialAgents, animated, resetCycle]);

  const clusterPos = clusterPositions(agents.length, size);
  const isDispersed = phase !== "idle" && phase !== "converging";
  const rowHeight = 28;
  const listTop = 4;

  return (
    <div className={cn("flex items-start gap-4", className)}>
      {/* Central cluster SVG */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={size * 0.035} fill={MINT} opacity={0.5}>
            <animate
              attributeName="opacity"
              values="0.3;0.6;0.3"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          {clusterPos.map((pos, i) => {
            const dispersed = i < dispersedCount && isDispersed;
            const targetY = listTop + i * rowHeight + 10;
            const targetX = size + 16;
            return (
              <circle
                key={i}
                r={2}
                fill={MINT}
                style={{
                  cx: dispersed ? targetX : pos.x,
                  cy: dispersed ? targetY : pos.y,
                  opacity: dispersed ? 0.9 : 0.4,
                  transition: "all 0.6s ease-out",
                }}
              >
                {!dispersed && (
                  <animate
                    attributeName="opacity"
                    values="0.2;0.5;0.2"
                    dur={`${1.5 + i * 0.15}s`}
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            );
          })}
        </svg>
      </div>

      {/* Agent list */}
      <div className="flex flex-col gap-1 min-w-0">
        {agents.map((agent, i) => {
          const visible = i < dispersedCount && isDispersed;
          return (
            <div
              key={i}
              className="flex items-center gap-2 h-7"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(-12px)",
                transition: "all 0.4s ease-out",
              }}
            >
              <StatusIcon status={agent.status} />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{agent.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
