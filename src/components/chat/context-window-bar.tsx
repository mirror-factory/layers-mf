"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Info, Zap, DollarSign, Database, Cpu } from "lucide-react";
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
  if (n <= 0) return "$0";
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

interface AgentRunSummary {
  model: string;
  total_input_tokens: number;
  total_output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  gateway_cost_usd: string;
  duration_ms: number;
  created_at: string;
}

interface ConversationTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  cacheHitPct: number;
}

interface ContextWindowBarProps {
  messages: UIMessage[];
  modelId: string;
  conversationId?: string | null;
  className?: string;
}

function getProviderIcon(modelId: string): string {
  if (modelId.startsWith("anthropic/")) return "A";
  if (modelId.startsWith("openai/")) return "O";
  if (modelId.startsWith("google/")) return "G";
  return "?";
}

function formatModelShort(modelId: string): string {
  const parts = modelId.split("/");
  return parts[parts.length - 1] ?? modelId;
}

export function ContextWindowBar({ messages, modelId, conversationId, className }: ContextWindowBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRunSummary[]>([]);
  const [totals, setTotals] = useState<ConversationTotals | null>(null);

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

  // Fetch conversation cost stats — re-fetch when messages change or breakdown is opened
  useEffect(() => {
    if (!conversationId) return;
    // Always fetch when breakdown is shown, or when messages change (to update totals)
    if (!showCostBreakdown && agentRuns.length > 0) return; // skip if hidden and we already have data
    // Small delay to let agent_run insert complete
    const timer = setTimeout(() => {
      fetch(`/api/chat/stats?conversation_id=${conversationId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setAgentRuns(data.runs ?? []);
            setTotals(data.totals ?? null);
          }
        })
        .catch(() => {});
    }, showCostBreakdown ? 0 : 1500); // immediate when expanded, delayed otherwise
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCostBreakdown, conversationId, messages.length]);

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

  // Use actual cost from stats if available, otherwise estimate
  const actualTotalCost = totals?.costUsd ?? 0;
  const cacheHitPct = totals?.cacheHitPct ?? 0;

  // Estimate cumulative conversation cost (all messages sent so far)
  const userMessages = messages.filter((m) => m.role === "user").length;
  const assistantTokens = messages
    .filter((m) => m.role === "assistant")
    .reduce(
      (sum, msg) =>
        sum + estimateMessageTokens(msg as { role: string; parts?: { type: string; text?: string; input?: unknown; output?: unknown }[] }),
      0,
    );
  const estimatedCumulativeCost =
    (historyTokens / 1_000_000) * pricing.input * (userMessages / Math.max(1, messages.length)) +
    (assistantTokens / 1_000_000) * pricing.output;
  const cumulativeCost = actualTotalCost > 0 ? actualTotalCost : estimatedCumulativeCost;

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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(!expanded); }}
        className="flex items-center gap-2 w-full text-left group hover:bg-muted/50 rounded-md px-2 py-1 transition-colors cursor-pointer"
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
        {/* Cache hit badge */}
        {cacheHitPct > 0 && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium whitespace-nowrap">
            {cacheHitPct}% cached
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </div>

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
                  {actualTotalCost > 0 ? "" : "~"}{formatCost(cumulativeCost)} total
                </span>
              )}
            </div>
          </div>

          {/* Cache stats */}
          {totals && (totals.cacheReadTokens > 0 || totals.cacheWriteTokens > 0) && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">{formatTokens(totals.cacheReadTokens)} cache hits</span>
              </div>
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3 text-amber-400" />
                <span className="text-amber-400">{formatTokens(totals.cacheWriteTokens)} cached</span>
              </div>
              <span className="text-emerald-400 font-medium">{cacheHitPct}% hit rate</span>
            </div>
          )}

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

          {/* Cost breakdown toggle */}
          {conversationId && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCostBreakdown(!showCostBreakdown); }}
              className="flex items-center gap-1.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
            >
              <DollarSign className="h-3 w-3" />
              <span>{showCostBreakdown ? "Hide" : "Show"} cost breakdown</span>
              {showCostBreakdown ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            </button>
          )}

          {/* Per-call cost breakdown */}
          {showCostBreakdown && agentRuns.length > 0 && (
            <div className="pt-1.5 border-t border-border/30 space-y-1.5">
              <div className="text-[10px] text-muted-foreground font-medium mb-1">
                LLM Calls ({agentRuns.length})
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {agentRuns.map((run, i) => {
                  const runCost = parseFloat(run.gateway_cost_usd ?? "0");
                  const runCacheRead = run.cache_read_tokens ?? 0;
                  return (
                    <div
                      key={`run-${i}`}
                      className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5"
                    >
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-muted text-[8px] font-bold shrink-0">
                        {getProviderIcon(run.model)}
                      </span>
                      <span className="truncate flex-1 min-w-0" title={run.model}>
                        {formatModelShort(run.model)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-0.5">
                          <Cpu className="h-2.5 w-2.5 text-blue-400" />
                          {formatTokens(run.total_input_tokens ?? 0)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Cpu className="h-2.5 w-2.5 text-green-400" />
                          {formatTokens(run.total_output_tokens ?? 0)}
                        </span>
                        {runCacheRead > 0 && (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <Database className="h-2.5 w-2.5" />
                            {formatTokens(runCacheRead)}
                          </span>
                        )}
                        <span className="font-mono w-14 text-right text-emerald-400">
                          {formatCost(runCost)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Running total */}
              {totals && (
                <div className="flex items-center justify-between pt-1.5 border-t border-border/30 text-[10px]">
                  <span className="text-muted-foreground font-medium">Total</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {formatTokens(totals.inputTokens)} in / {formatTokens(totals.outputTokens)} out
                    </span>
                    <span className="font-mono font-medium text-emerald-400">
                      {formatCost(totals.costUsd)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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
