import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";
import {
  verifyDiscordSignature,
  batchMessagesToContent,
  buildMessageMetadata,
} from "@/lib/integrations/discord";
import { claimWebhookEvent, completeWebhookEvent } from "@/lib/webhook-dedup";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

// ── Discord Interaction Types ────────────────────────────────────────────────

// Discord interaction types
const INTERACTION_PING = 1;

// Discord event types (for Gateway-style events forwarded via webhook)
const EVENT_MESSAGE_CREATE = "MESSAGE_CREATE";
const EVENT_THREAD_CREATE = "THREAD_CREATE";

interface DiscordInteraction {
  type: number;
  // Gateway event fields (when using event webhook)
  t?: string; // event type
  d?: Record<string, unknown>; // event data
}

interface DiscordMessageData {
  id: string;
  channel_id: string;
  guild_id?: string;
  content: string;
  timestamp: string;
  author: {
    id: string;
    username: string;
    global_name?: string | null;
    bot?: boolean;
  };
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

interface DiscordThreadData {
  id: string;
  name: string;
  guild_id?: string;
  parent_id?: string;
  owner_id?: string;
  type: number;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[webhook:discord] DISCORD_PUBLIC_KEY not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Verify Ed25519 signature
  const isValid = await verifyDiscordSignature(rawBody, signature, timestamp, publicKey);
  if (!isValid) {
    console.warn("[webhook:discord] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Respond to Discord PING verification challenge
  if (interaction.type === INTERACTION_PING) {
    return NextResponse.json({ type: 1 }); // PONG
  }

  // Handle gateway-style events
  const eventType = interaction.t;
  const eventData = interaction.d;

  if (!eventType || !eventData) {
    return NextResponse.json({ received: true });
  }

  // Idempotency: use the event data id (message id, thread id, etc.)
  const dataId = (eventData as Record<string, unknown>).id as string | undefined;
  const eventId = dataId ? `${eventType}-${dataId}` : `${eventType}-${Date.now()}`;
  const isNew = await claimWebhookEvent("discord", eventId, eventType);
  if (!isNew) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  // Return 200 immediately, process async
  const response = NextResponse.json({ received: true });

  // Fire-and-forget processing
  processDiscordEvent(eventType, eventData)
    .then(() => completeWebhookEvent("discord", eventId, "completed"))
    .catch((err) => {
      console.error("[webhook:discord] Processing error:", err);
      completeWebhookEvent("discord", eventId, "failed");
    });

  return response;
}

// ── Async Event Processing ──────────────────────────────────────────────────

async function processDiscordEvent(
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  switch (eventType) {
    case EVENT_MESSAGE_CREATE:
      await handleMessageCreate(data as unknown as DiscordMessageData);
      break;
    case EVENT_THREAD_CREATE:
      await handleThreadCreate(data as unknown as DiscordThreadData);
      break;
    default:
      console.log(`[webhook:discord] Unhandled event type: ${eventType}`);
  }
}

// ── Message Handler ─────────────────────────────────────────────────────────

async function handleMessageCreate(msg: DiscordMessageData): Promise<void> {
  // Skip bot messages
  if (msg.author.bot) return;

  // Skip empty messages
  if (!msg.content || msg.content.trim().length < 10) return;

  const supabase = createAdminClient();

  // Multi-tenant: match by guild_id stored in sync_config.provider_workspace_id
  const guildId = msg.guild_id;
  let integration: { org_id: string; sync_config: unknown } | null = null;

  if (guildId) {
    const { data } = await supabase
      .from("integrations")
      .select("org_id, sync_config")
      .eq("provider", "discord")
      .eq("status", "active")
      .eq("sync_config->>provider_workspace_id", guildId)
      .maybeSingle();
    integration = data;

    // Fallback for older integrations without sync_config
    if (!integration) {
      const { data: fallback } = await supabase
        .from("integrations")
        .select("org_id, sync_config")
        .eq("provider", "discord")
        .eq("status", "active")
        .is("sync_config", null)
        .limit(1)
        .maybeSingle();
      if (fallback) {
        await supabase
          .from("integrations")
          .update({ sync_config: { provider_workspace_id: guildId } })
          .eq("org_id", fallback.org_id)
          .eq("provider", "discord");
        integration = fallback;
      }
    }
  } else {
    // No guild_id (DM context) — fall back to single match
    const { data } = await supabase
      .from("integrations")
      .select("org_id, sync_config")
      .eq("provider", "discord")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    integration = data;
  }

  if (!integration) {
    console.warn("[webhook:discord] No active Discord integration found");
    return;
  }

  const orgId = integration.org_id;
  const authorName = msg.author.global_name ?? msg.author.username;

  // Batch by channel — aggregate into a channel-level context item
  // Source ID is channel-based so messages aggregate into one item per channel
  const sourceId = `discord-channel-${msg.channel_id}`;

  const sourceMetadata = buildMessageMetadata({
    channelId: msg.channel_id,
    guildId: msg.guild_id,
    authorId: msg.author.id,
    authorName,
    threadId: msg.thread?.id,
  });

  // Build content for this individual message
  const time = new Date(msg.timestamp).toISOString().slice(0, 16).replace("T", " ");
  let messageText = `[${time}] ${authorName}: ${msg.content}`;

  // Include reply context if present
  if (msg.referenced_message) {
    messageText = `[${time}] ${authorName} (replying to ${msg.referenced_message.author.username}): ${msg.content}`;
  }

  // Check if we already have a context item for this channel
  const { data: existing } = await supabase
    .from("context_items")
    .select("id, raw_content")
    .eq("org_id", orgId)
    .eq("source_type", "discord")
    .eq("source_id", sourceId)
    .maybeSingle();

  let itemId: string;

  if (existing) {
    // Append new message to existing channel content
    const updatedContent = (existing.raw_content + "\n" + messageText).slice(-12000);

    await supabase
      .from("context_items")
      .update({
        raw_content: updatedContent,
        source_metadata: sourceMetadata as Json,
        status: "processing",
      })
      .eq("id", existing.id);
    itemId = existing.id;
  } else {
    const title = `#${msg.channel_id} — Discord messages`;
    const content = `Discord channel messages\n\n${messageText}`;

    const { data: inserted, error } = await supabase
      .from("context_items")
      .insert({
        org_id: orgId,
        source_type: "discord",
        source_id: sourceId,
        title,
        raw_content: content,
        content_type: "message",
        source_metadata: sourceMetadata as Json,
        status: "processing",
        source_created_at: msg.timestamp,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(`[webhook:discord] DB insert error for ${sourceId}:`, error?.message);
      return;
    }
    itemId = inserted.id;
  }

  // Run AI extraction + embedding pipeline
  await runPipeline(supabase, orgId, itemId, sourceId);
}

// ── Thread Handler ──────────────────────────────────────────────────────────

async function handleThreadCreate(thread: DiscordThreadData): Promise<void> {
  const supabase = createAdminClient();

  // Multi-tenant: match by guild_id stored in sync_config.provider_workspace_id
  const guildId = thread.guild_id;
  let integration: { org_id: string } | null = null;

  if (guildId) {
    const { data } = await supabase
      .from("integrations")
      .select("org_id")
      .eq("provider", "discord")
      .eq("status", "active")
      .eq("sync_config->>provider_workspace_id", guildId)
      .maybeSingle();
    integration = data;

    if (!integration) {
      const { data: fallback } = await supabase
        .from("integrations")
        .select("org_id")
        .eq("provider", "discord")
        .eq("status", "active")
        .is("sync_config", null)
        .limit(1)
        .maybeSingle();
      if (fallback) {
        await supabase
          .from("integrations")
          .update({ sync_config: { provider_workspace_id: guildId } })
          .eq("org_id", fallback.org_id)
          .eq("provider", "discord");
        integration = fallback;
      }
    }
  } else {
    const { data } = await supabase
      .from("integrations")
      .select("org_id")
      .eq("provider", "discord")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    integration = data;
  }

  if (!integration) {
    console.warn("[webhook:discord] No active Discord integration found");
    return;
  }

  const orgId = integration.org_id;
  const sourceId = `discord-thread-${thread.id}`;

  const content = `New Discord thread: "${thread.name}"`;
  if (content.length < 10) return;

  const sourceMetadata = {
    channelId: thread.id,
    guildId: thread.guild_id ?? null,
    parentChannelId: thread.parent_id ?? null,
    threadId: thread.id,
    threadName: thread.name,
  };

  const { data: inserted, error } = await supabase
    .from("context_items")
    .insert({
      org_id: orgId,
      source_type: "discord",
      source_id: sourceId,
      title: `Thread: ${thread.name}`,
      raw_content: content,
      content_type: "message",
      source_metadata: sourceMetadata as Json,
      status: "processing",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error(`[webhook:discord] DB insert error for thread ${thread.id}:`, error?.message);
    return;
  }

  await runPipeline(supabase, orgId, inserted.id, sourceId);
}

// ── Shared Pipeline Runner ──────────────────────────────────────────────────

async function runPipeline(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  itemId: string,
  sourceId: string
): Promise<void> {
  // Re-fetch the current content for processing
  const { data: item } = await supabase
    .from("context_items")
    .select("raw_content, title")
    .eq("id", itemId)
    .single();

  if (!item) return;

  try {
    const [extraction, embedding] = await Promise.all([
      extractStructured(item.raw_content ?? "", item.title ?? "Untitled"),
      generateEmbedding(item.raw_content ?? ""),
    ]);

    await supabase
      .from("context_items")
      .update({
        title: extraction.title,
        description_short: extraction.description_short,
        description_long: extraction.description_long,
        entities: extraction.entities,
        embedding: embedding as unknown as string,
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    await createInboxItems(supabase, orgId, itemId, extraction, "discord");
  } catch (err) {
    console.error(`[webhook:discord] Pipeline error for ${sourceId}:`, err);
    await supabase
      .from("context_items")
      .update({ status: "error" })
      .eq("id", itemId);
  }
}
