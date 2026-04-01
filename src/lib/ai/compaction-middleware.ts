/**
 * Conversation Compaction Middleware
 *
 * Uses transformParams to check total message tokens before each LLM call.
 * When context exceeds a threshold (80% of window), older turns are summarized
 * using a fast model (Haiku) and replaced with a compact summary message.
 */

import type { LanguageModelMiddleware } from "ai";
import { generateText } from "ai";
import { gateway } from "@/lib/ai/config";
import { estimateTokens } from "@/lib/ai/token-counter";

const COMPACTION_MODEL = "anthropic/claude-haiku-4-5-20251001";
const KEEP_RECENT_TURNS = 4;

/** Estimate total tokens in a prompt array */
function estimatePromptTokens(prompt: Array<{ role: string; content: unknown }>): number {
  let tokens = 0;
  for (const msg of prompt) {
    if (typeof msg.content === "string") {
      tokens += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && typeof part.text === "string") {
          tokens += estimateTokens(part.text);
        } else if (part.type === "tool-call") {
          tokens += estimateTokens(JSON.stringify(part.args ?? {}));
          tokens += 20;
        } else if (part.type === "tool-result" && Array.isArray(part.content)) {
          for (const r of part.content) {
            if (r.type === "text" && typeof r.text === "string") {
              tokens += estimateTokens(r.text);
            }
          }
        }
      }
    }
  }
  return tokens;
}

/** Serialize messages to transcript for summarization */
function messagesToTranscript(
  messages: Array<{ role: string; content: unknown }>,
): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role === "system") continue;
    const role = msg.role === "user" ? "User" : "Assistant";
    const parts: string[] = [];
    if (typeof msg.content === "string") {
      parts.push(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && typeof part.text === "string") {
          parts.push(part.text);
        } else if (part.type === "tool-call") {
          parts.push(`[Called tool: ${part.toolName}]`);
        } else if (part.type === "tool-result" && Array.isArray(part.content)) {
          const text = part.content
            .filter((c: { type: string; text?: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join("\n");
          if (text) parts.push(`[Tool result: ${text.slice(0, 200)}]`);
        }
      }
    }
    if (parts.length > 0) {
      lines.push(`${role}: ${parts.join("\n")}`);
    }
  }
  return lines.join("\n\n");
}

/**
 * Create a compaction middleware for the given context window size.
 */
export function createCompactionMiddleware(
  contextWindowTokens: number,
  thresholdPct = 0.80,
): LanguageModelMiddleware {
  const threshold = Math.floor(contextWindowTokens * thresholdPct);

  return {
    specificationVersion: "v3" as const,
    transformParams: async ({ params }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prompt = params.prompt as any[];
      const totalTokens = estimatePromptTokens(prompt);

      if (totalTokens <= threshold) {
        return params;
      }

      console.log(
        `[compaction] ${totalTokens} tokens exceeds threshold ${threshold} — compacting`,
      );

      const systemMessages = prompt.filter((m: { role: string }) => m.role === "system");
      const nonSystem = prompt.filter((m: { role: string }) => m.role !== "system");

      const keepRecent = nonSystem.slice(-KEEP_RECENT_TURNS);
      const toCompact = nonSystem.slice(0, -KEEP_RECENT_TURNS);

      if (toCompact.length === 0) {
        return params;
      }

      const transcript = messagesToTranscript(toCompact);

      try {
        const { text: summary } = await generateText({
          model: gateway(COMPACTION_MODEL),
          prompt: `Summarize this conversation excerpt in 2-3 concise paragraphs. Preserve: key decisions, action items, important facts, tool results, and any commitments made. Be direct and factual.\n\n---\n${transcript}`,
        });

        const summaryMessage = {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: `[Conversation summary — earlier messages were compacted to save context]\n\n${summary}`,
            },
          ],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newPrompt: any = [
          ...systemMessages,
          summaryMessage,
          ...keepRecent,
        ];

        const newTokens = estimatePromptTokens(newPrompt);
        console.log(
          `[compaction] Reduced from ${totalTokens} to ${newTokens} tokens (saved ${totalTokens - newTokens})`,
        );

        return {
          ...params,
          prompt: newPrompt,
        };
      } catch (err) {
        console.error("[compaction] Summarization failed, skipping:", err);
        return params;
      }
    },
  };
}
