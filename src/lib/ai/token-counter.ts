/**
 * Token estimation and context window utilities.
 *
 * Uses character-based heuristic (~4 chars per token) since no SDK utility exists.
 * Good enough for UI display; actual billing uses provider-reported counts.
 */

// Context window sizes per model (input tokens)
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic
  "anthropic/claude-opus-4.6": 200_000,
  "anthropic/claude-sonnet-4.6": 200_000,
  "anthropic/claude-haiku-4-5-20251001": 200_000,
  "anthropic/claude-haiku-4.5": 200_000,
  // OpenAI
  "openai/gpt-4o": 128_000,
  "openai/gpt-4o-mini": 128_000,
  "openai/gpt-5.4": 128_000,
  "openai/gpt-5.4-mini": 128_000,
  "openai/gpt-5-nano": 128_000,
  // Google
  "google/gemini-pro": 2_000_000,
  "google/gemini-flash": 1_000_000,
  "google/gemini-3-pro": 2_000_000,
  "google/gemini-3-flash": 1_000_000,
  "google/gemini-2.5-flash-lite": 1_000_000,
};

// Pricing per million tokens (input, output) in USD
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "anthropic/claude-opus-4.6": { input: 15, output: 75 },
  "anthropic/claude-sonnet-4.6": { input: 3, output: 15 },
  "anthropic/claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "anthropic/claude-haiku-4.5": { input: 0.8, output: 4 },
  "openai/gpt-4o": { input: 2.5, output: 10 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-5.4": { input: 2.5, output: 10 },
  "openai/gpt-5.4-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-5-nano": { input: 0.1, output: 0.4 },
  "google/gemini-pro": { input: 1.25, output: 5 },
  "google/gemini-flash": { input: 0.075, output: 0.3 },
  "google/gemini-3-pro": { input: 1.25, output: 5 },
  "google/gemini-3-flash": { input: 0.075, output: 0.3 },
  "google/gemini-2.5-flash-lite": { input: 0.075, output: 0.3 },
};

/** Estimate token count from text using ~4 chars/token heuristic */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Estimate tokens for a JSON object (stringified) */
export function estimateJsonTokens(obj: unknown): number {
  return estimateTokens(JSON.stringify(obj));
}

/** Get context window size for a model, defaults to 128K */
export function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? 128_000;
}

/** Get pricing for a model */
export function getPricing(modelId: string): { input: number; output: number } {
  return MODEL_PRICING[modelId] ?? { input: 1, output: 5 };
}

/** Calculate cost in USD for given token counts */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getPricing(modelId);
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export interface ContextBreakdown {
  system: number;
  rules: number;
  tools: number;
  history: number;
  total: number;
  contextWindow: number;
  available: number;
  utilizationPct: number;
  estimatedCostPerMessage: number;
}

/** Build a context breakdown from message parts */
export function buildContextBreakdown(params: {
  systemPrompt: string;
  rulesText: string;
  toolDefinitions: string;
  historyText: string;
  modelId: string;
}): ContextBreakdown {
  const system = estimateTokens(params.systemPrompt);
  const rules = estimateTokens(params.rulesText);
  const tools = estimateTokens(params.toolDefinitions);
  const history = estimateTokens(params.historyText);
  const total = system + rules + tools + history;
  const contextWindow = getContextWindow(params.modelId);
  const available = Math.max(0, contextWindow - total);
  const utilizationPct = Math.min(100, (total / contextWindow) * 100);
  const pricing = getPricing(params.modelId);
  // Estimate cost for one round-trip (input + ~500 output tokens)
  const estimatedCostPerMessage =
    (total / 1_000_000) * pricing.input +
    (500 / 1_000_000) * pricing.output;

  return {
    system,
    rules,
    tools,
    history,
    total,
    contextWindow,
    available,
    utilizationPct,
    estimatedCostPerMessage,
  };
}

/** Estimate tokens in a UIMessage-like object */
export function estimateMessageTokens(message: {
  role: string;
  parts?: { type: string; text?: string; input?: unknown; output?: unknown }[];
}): number {
  if (!message.parts) return 0;
  let tokens = 4; // role overhead
  for (const part of message.parts) {
    if (part.type === "text" && part.text) {
      tokens += estimateTokens(part.text);
    } else if (part.type.startsWith("tool-")) {
      if (part.input) tokens += estimateJsonTokens(part.input);
      if (part.output) tokens += estimateJsonTokens(part.output);
    }
  }
  return tokens;
}
