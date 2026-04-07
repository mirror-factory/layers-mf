"use client";

import { useState } from "react";
import { Info, Zap, Clock, Cpu, Database, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateCost, getPricing } from "@/lib/ai/token-counter";

interface MessageStatsData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  toolCalls: string[];
  stepDetails?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
    durationMs: number;
    toolCalls: string[];
  }[];
}

interface MessageStatsProps {
  /** Model ID used for this message */
  model: string;
  /** Raw text of the assistant response (for token estimation fallback) */
  text: string;
  /** Stats from agent_runs if available */
  stats?: MessageStatsData | null;
  className?: string;
}

function formatModelName(modelId: string): string {
  const parts = modelId.split("/");
  const name = parts[parts.length - 1] ?? modelId;
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(n: number): string {
  if (n <= 0) return "$0";
  if (n < 0.001) return "<$0.001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function getProviderIcon(modelId: string): string {
  if (modelId.startsWith("anthropic/")) return "A";
  if (modelId.startsWith("openai/")) return "O";
  if (modelId.startsWith("google/")) return "G";
  return "?";
}

export function MessageStats({ model, text, stats, className }: MessageStatsProps) {
  const [open, setOpen] = useState(false);

  // Fallback: estimate cost from text length if no stats available
  const estimatedOutputTokens = stats?.outputTokens ?? Math.ceil(text.length / 4);
  const estimatedInputTokens = stats?.inputTokens ?? 0;
  const cacheRead = stats?.cacheReadTokens ?? 0;
  const cacheWrite = stats?.cacheWriteTokens ?? 0;
  const durationMs = stats?.durationMs ?? 0;
  const toolCalls = stats?.toolCalls ?? [];
  const costUsd = stats?.costUsd ?? calculateCost(model, estimatedInputTokens, estimatedOutputTokens);

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors",
          open
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/50"
        )}
        title="Message stats"
      >
        <Info className="h-2.5 w-2.5" />
        <span>{formatCost(costUsd)}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 z-50 w-72 rounded-lg border border-border/50 bg-card shadow-xl text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="p-3 space-y-2.5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-primary/10 text-primary text-[9px] font-bold">
                  {getProviderIcon(model)}
                </span>
                <span className="font-medium text-foreground">{formatModelName(model)}</span>
              </div>
              {durationMs > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(durationMs)}</span>
                </div>
              )}
            </div>

            {/* Token breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-blue-400" />
                <span>Input</span>
              </div>
              <span className="text-right font-mono">{formatTokens(estimatedInputTokens)}</span>

              <div className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-green-400" />
                <span>Output</span>
              </div>
              <span className="text-right font-mono">{formatTokens(estimatedOutputTokens)}</span>

              {(cacheRead > 0 || cacheWrite > 0) && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-emerald-400" />
                    <span>Cache read</span>
                  </div>
                  <span className="text-right font-mono text-emerald-400">{formatTokens(cacheRead)}</span>

                  <div className="flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-amber-400" />
                    <span>Cache write</span>
                  </div>
                  <span className="text-right font-mono text-amber-400">{formatTokens(cacheWrite)}</span>
                </>
              )}
            </div>

            {/* Cost */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-mono font-medium text-emerald-400">{formatCost(costUsd)}</span>
            </div>

            {/* Cache hit rate badge */}
            {cacheRead > 0 && (
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 text-[10px] font-medium">
                  {Math.round((cacheRead / (estimatedInputTokens + cacheRead)) * 100)}% cache hit rate
                </span>
              </div>
            )}

            {/* Tool calls */}
            {toolCalls.length > 0 && (
              <div className="pt-1.5 border-t border-border/30">
                <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  <span>Tools ({toolCalls.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {toolCalls.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="inline-block px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Per-step breakdown if multiple steps */}
            {stats?.stepDetails && stats.stepDetails.length > 1 && (
              <div className="pt-1.5 border-t border-border/30">
                <span className="text-muted-foreground text-[10px] font-medium mb-1 block">
                  Steps ({stats.stepDetails.length})
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {stats.stepDetails.map((step, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-mono bg-muted px-1 rounded">{i + 1}</span>
                        {step.toolCalls.length > 0 && (
                          <span className="truncate max-w-[120px]">{step.toolCalls.join(", ")}</span>
                        )}
                        {step.toolCalls.length === 0 && <span>generate</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{formatTokens(step.inputTokens + step.outputTokens)}</span>
                        <span className="font-mono">{formatDuration(step.durationMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
