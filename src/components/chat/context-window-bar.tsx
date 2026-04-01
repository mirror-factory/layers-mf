"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Info, Zap, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  estimateMessageTokens,
  getContextWindow,
  getPricing,
} from "@/lib/ai/token-counter";
import type { UIMessage } from "ai";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.001) return "<$0.001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

interface SegmentDef {
  key: string;
  label: string;
  tokens: number;
  color: string;
}

interface ServerStats {
  systemPromptTokens: number;
  rulesTokens: number;
  rulesCount: number;
  toolsTokens: number;
  mcpServerCount: number;
}

interface ContextWindowBarProps {
  messages: UIMessage[];
  modelId: string;
  className?: string;
}

export function ContextWindowBar({ messages, modelId, className }: ContextWindowBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);

  // Fetch server-side token stats when expanded (and on model change)
  useEffect(() => {
    if (!expanded) return;
    const params = new URLSearchParams({ modelId });
    fetch(`/api/chat/context-stats?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setServerStats(data);
      })
      .catch(() => {});
  }, [expanded, modelId]);

  // Estimate tokens from conversation history
  const historyTokens = messages.reduce(
    (sum, msg) =>
      sum + estimateMessageTokens(msg as { role: string; parts?: { type: string; text?: string; input?: unknown; output?: unknown }[] }),
    0,
  );

  // Use server stats if available, otherwise rough estimates
  const systemTokens = serverStats?.systemPromptTokens ?? 1_000;
  const rulesTokens = serverStats?.rulesTokens ?? 200;
  const toolsTokens = serverStats?.toolsTokens ?? 3_000;

  const totalUsed = systemTokens + rulesTokens + toolsTokens + historyTokens;
  const contextWindow = getContextWindow(modelId);
  const available = Math.max(0, contextWindow - totalUsed);
  const utilizationPct = Math.min(100, (totalUsed / contextWindow) * 100);

  const pricing = getPricing(modelId);
  const costPerMessage =
    (totalUsed / 1_000_000) * pricing.input +
    (500 / 1_000_000) * pricing.output;

  // Estimate cumulative conversation cost (all messages sent so far)
  const userMessages = messages.filter((m) => m.role === "user").length;
  const assistantTokens = messages
    .filter((m) => m.role === "assistant")
    .reduce(
      (sum, msg) =>
        sum + estimateMessageTokens(msg as { role: string; parts?: { type: string; text?: string; input?: unknown; output?: unknown }[] }),
      0,
    );
  const cumulativeCost =
    (historyTokens / 1_000_000) * pricing.input * (userMessages / Math.max(1, messages.length)) +
    (assistantTokens / 1_000_000) * pricing.output;

  const segments: SegmentDef[] = [
    { key: "system", label: "System", tokens: systemTokens, color: "bg-blue-500" },
    { key: "rules", label: "Rules", tokens: rulesTokens, color: "bg-purple-500" },
    { key: "tools", label: "Tools", tokens: toolsTokens, color: "bg-amber-500" },
    { key: "history", label: "History", tokens: historyTokens, color: "bg-green-500" },
  ];

  const segmentWidths = segments.map((s) => ({
    ...s,
    pct: Math.max(0.5, (s.tokens / contextWindow) * 100),
  }));

  const utilizationColor =
    utilizationPct > 90
      ? "text-red-500"
      : utilizationPct > 70
        ? "text-amber-500"
        : "text-green-500";

  return (
    <div className={cn("w-full", className)}>
      {/* Compact bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group hover:bg-muted/50 rounded-md px-2 py-1 transition-colors"
      >
        <Zap className={cn("h-3 w-3 shrink-0", utilizationColor)} />
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
          {segmentWidths.map((s) => (
            <div
              key={s.key}
              className={cn("h-full transition-all duration-300", s.color)}
              style={{ width: `${s.pct}%` }}
              title={`${s.label}: ${formatTokens(s.tokens)}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {formatTokens(totalUsed)} / {formatTokens(contextWindow)}
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="mt-1 rounded-md border bg-card p-3 text-xs space-y-3 animate-in slide-in-from-top-1 duration-200">
          {/* Segment breakdown */}
          <div className="space-y-1.5">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full shrink-0", s.color)} />
                <span className="text-muted-foreground w-14">{s.label}</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", s.color)}
                    style={{
                      width: `${Math.max(1, (s.tokens / totalUsed) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-mono w-12 text-right">{formatTokens(s.tokens)}</span>
              </div>
            ))}
          </div>

          {/* Summary row */}
          <div className="flex items-center justify-between pt-2 border-t text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className={cn("font-medium", utilizationColor)}>
                {utilizationPct.toFixed(1)}% used
              </span>
              <span>{formatTokens(available)} available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>~{formatCost(costPerMessage)}/msg</span>
              </div>
              {cumulativeCost > 0.0001 && (
                <span className="text-[10px] border-l pl-2">
                  ~{formatCost(cumulativeCost)} total
                </span>
              )}
            </div>
          </div>

          {/* Conversation stats */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>{messages.length} messages</span>
            <span>{messages.filter((m) => m.role === "user").length} user</span>
            <span>{messages.filter((m) => m.role === "assistant").length} assistant</span>
            {serverStats && (
              <>
                <span>{serverStats.rulesCount} rules</span>
                <span>{serverStats.mcpServerCount} MCP servers</span>
              </>
            )}
          </div>

          {utilizationPct > 80 && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-amber-600 dark:text-amber-400">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>
                Context window is {utilizationPct > 90 ? "nearly full" : "filling up"}.
                Older messages will be pruned to make room.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
