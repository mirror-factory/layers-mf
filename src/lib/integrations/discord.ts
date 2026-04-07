// ── Discord Types ────────────────────────────────────────────────────────────

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = text, 2 = voice, 11 = public thread, 12 = private thread
  guild_id: string;
  parent_id: string | null;
  topic: string | null;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    global_name: string | null;
    bot?: boolean;
  };
  content: string;
  timestamp: string;
  thread?: {
    id: string;
    name: string;
  } | null;
  referenced_message?: {
    id: string;
    author: { username: string };
    content: string;
  } | null;
}

// ── Content Builders ─────────────────────────────────────────────────────────

/**
 * Batch messages by channel into a single content string.
 * Groups messages chronologically with author attribution.
 */
export function batchMessagesToContent(
  messages: DiscordMessage[],
  channelName: string,
  guildName: string
): string {
  if (messages.length === 0) return "";

  // Sort chronologically (oldest first)
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const lines: string[] = [];
  lines.push(`Discord — #${channelName} in ${guildName}`);
  lines.push(`Messages: ${sorted.length}`);
  lines.push(`Period: ${sorted[0].timestamp} to ${sorted[sorted.length - 1].timestamp}`);
  lines.push("");

  for (const msg of sorted) {
    if (!msg.content || msg.content.trim().length === 0) continue;
    const author = msg.author.global_name ?? msg.author.username;
    const time = new Date(msg.timestamp).toISOString().slice(0, 16).replace("T", " ");
    lines.push(`[${time}] ${author}: ${msg.content}`);
  }

  return lines.join("\n").slice(0, 12000);
}

/**
 * Build source metadata for a Discord channel context item.
 */
export function buildChannelMetadata(
  channelId: string,
  channelName: string,
  guildId: string,
  guildName: string,
  messageCount: number,
  lastMessageId: string | null
) {
  return {
    channelId,
    channelName,
    guildId,
    guildName,
    messageCount,
    lastMessageId,
  };
}

/**
 * Build source metadata for a single Discord message (used by webhook).
 */
export function buildMessageMetadata(params: {
  channelId: string;
  channelName?: string;
  guildId?: string;
  guildName?: string;
  authorId: string;
  authorName: string;
  threadId?: string | null;
}) {
  return {
    channelId: params.channelId,
    channelName: params.channelName ?? null,
    guildId: params.guildId ?? null,
    guildName: params.guildName ?? null,
    authorId: params.authorId,
    authorName: params.authorName,
    threadId: params.threadId ?? null,
  };
}

// ── Signature Verification ───────────────────────────────────────────────────

/**
 * Verify Discord webhook interaction signature using Ed25519.
 * Discord sends the signature in the `X-Signature-Ed25519` header
 * and the timestamp in `X-Signature-Timestamp`.
 */
export async function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string
): Promise<boolean> {
  if (!rawBody || !signature || !timestamp || !publicKey) return false;

  try {
    // Import the public key
    const keyBytes = hexToUint8Array(publicKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes.buffer as ArrayBuffer,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    // Build the message to verify (timestamp + body)
    const message = new TextEncoder().encode(timestamp + rawBody);
    const signatureBytes = hexToUint8Array(signature);

    return await crypto.subtle.verify("Ed25519", cryptoKey, signatureBytes.buffer as ArrayBuffer, message);
  } catch (err) {
    console.error("[discord] Signature verification error:", err);
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
