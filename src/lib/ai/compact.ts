import { generateText } from 'ai';
import { gateway, TASK_MODELS } from './config';

// Approximate tokens per character (conservative estimate)
const CHARS_PER_TOKEN = 4;

// Context window budget for conversation (leave room for priority docs + tools)
const MAX_CONVERSATION_TOKENS = 30000; // ~120K chars
const COMPACTION_THRESHOLD = 0.8; // Compact when at 80% of budget

// Number of recent messages to preserve verbatim
const KEEP_RECENT = 20;

interface CompactableMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

/**
 * Check if conversation needs compaction based on total character count.
 */
export function needsCompaction(messages: CompactableMessage[]): boolean {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedTokens = totalChars / CHARS_PER_TOKEN;
  return estimatedTokens > MAX_CONVERSATION_TOKENS * COMPACTION_THRESHOLD;
}

/**
 * Compact older messages into a summary, preserving recent messages.
 * Returns { summary, recentMessages } where recentMessages are the last ~20 messages.
 */
export async function compactHistory(
  messages: CompactableMessage[],
  existingSummary?: string
): Promise<{ summary: string; recentMessages: CompactableMessage[] }> {
  if (messages.length <= KEEP_RECENT) {
    return { summary: existingSummary ?? '', recentMessages: messages };
  }

  const olderMessages = messages.slice(0, -KEEP_RECENT);
  const recentMessages = messages.slice(-KEEP_RECENT);

  const previousContext = existingSummary
    ? `Previous conversation summary:\n${existingSummary}\n\n`
    : '';

  const messagesToCompact = olderMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const { text } = await generateText({
    model: gateway(TASK_MODELS.compaction),
    prompt: `You are summarizing a conversation between a partner and Granger (an AI chief of staff).
Preserve ALL of the following:
- Key decisions made (with who decided and when)
- Open action items with owners and deadlines
- Unresolved questions or topics needing follow-up
- Partner preferences or instructions expressed (e.g., "always CC me on emails")
- Any conflicts flagged with priority documents
- Tool calls made and their results (summarize, don't reproduce full output)
- Approval queue items proposed (approved, rejected, or still pending)

${previousContext}New messages to incorporate:
${messagesToCompact}

Write a concise but comprehensive summary (max 500 tokens). Use bullet points. Include names, dates, and specific details — vague summaries are useless.`,
  });

  return { summary: text, recentMessages };
}

/**
 * Build the conversation context string from a compacted summary.
 * Recent messages are handled by the ToolLoopAgent's message array directly.
 */
export function buildConversationContext(compactedSummary: string): string {
  if (!compactedSummary) return '';
  return `## Previous Conversation Context\n${compactedSummary}`;
}

/**
 * Extract plain text content from chat_messages rows.
 * Messages store content as JSON parts array: [{ type: "text", text: "..." }]
 */
export function extractTextFromParts(
  parts: Array<{ type: string; text?: string }> | string | null
): string {
  if (!parts) return '';
  if (typeof parts === 'string') return parts;
  return parts
    .filter(p => p.type === 'text' && p.text)
    .map(p => p.text!)
    .join(' ');
}
