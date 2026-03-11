import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";
import {
  fetchDiscordGuilds,
  fetchDiscordChannels,
  fetchDiscordMessages,
  batchMessagesToContent,
  buildChannelMetadata,
  type DiscordMessage,
} from "@/lib/integrations/discord";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

interface SyncResult {
  channels: number;
  messages: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connectionId: string;
  let provider: string;
  let incremental: boolean;
  try {
    const body = await request.json();
    connectionId = body.connectionId;
    provider = body.provider ?? "discord";
    incremental = body.incremental !== false; // default to incremental
    if (!connectionId) throw new Error("missing connectionId");
  } catch {
    return NextResponse.json(
      { error: "connectionId required" },
      { status: 400 }
    );
  }

  // Verify integration belongs to user's org
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id, sync_config")
    .eq("nango_connection_id", connectionId)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  const orgId = integration.org_id;
  const syncConfig = (integration.sync_config as Record<string, unknown> | null) ?? {};
  const channelCursors = (syncConfig.channelCursors as Record<string, string> | undefined) ?? {};

  const adminDb = createAdminClient();

  const result: SyncResult = {
    channels: 0,
    messages: 0,
    errors: [],
  };

  const newChannelCursors: Record<string, string> = { ...channelCursors };
  const syncStartedAt = new Date().toISOString();

  // ── Fetch Guilds ──────────────────────────────────────────────────────────

  const guilds = await fetchDiscordGuilds(connectionId, provider);
  if (guilds.length === 0) {
    return NextResponse.json({
      processed: 0,
      ...result,
      debug: ["No guilds found — is the bot added to a server?"],
    });
  }

  // ── Iterate Guilds → Channels → Messages ──────────────────────────────────

  for (const guild of guilds.slice(0, 5)) {
    const channels = await fetchDiscordChannels(connectionId, provider, guild.id);

    for (const channel of channels.slice(0, 10)) {
      try {
        // For incremental sync, only fetch messages after the last synced message ID
        const afterMessageId = incremental ? channelCursors[channel.id] : undefined;

        const messages = await fetchDiscordMessages(
          connectionId,
          provider,
          channel.id,
          { limit: 100, after: afterMessageId }
        );

        // Skip channels with no new messages
        if (messages.length === 0) continue;

        // Filter out bot messages and empty messages
        const humanMessages = messages.filter(
          (m) => !m.author.bot && m.content && m.content.trim().length > 0
        );

        if (humanMessages.length === 0) continue;

        // Track the latest message ID for incremental sync
        const latestMessageId = getLatestMessageId(messages);
        if (latestMessageId) {
          newChannelCursors[channel.id] = latestMessageId;
        }

        // Batch messages into a single context item per channel
        const content = batchMessagesToContent(humanMessages, channel.name, guild.name);
        if (content.length < 50) continue;

        const sourceId = `discord-channel-${channel.id}`;
        const metadata = buildChannelMetadata(
          channel.id,
          channel.name,
          guild.id,
          guild.name,
          humanMessages.length,
          latestMessageId
        );

        await upsertAndProcess(adminDb, orgId, {
          sourceId,
          contentType: "message",
          title: `#${channel.name} — ${guild.name}`,
          content,
          sourceMetadata: metadata,
          sourceCreatedAt: humanMessages[0]?.timestamp ?? null,
        });

        result.channels++;
        result.messages += humanMessages.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Channel #${channel.name}: ${msg}`);
      }
    }
  }

  // ── Update sync metadata ──────────────────────────────────────────────────

  const totalProcessed = result.channels;

  if (totalProcessed > 0) {
    await adminDb
      .from("integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_config: {
          ...syncConfig,
          channelCursors: newChannelCursors,
          lastFullSyncAt: syncStartedAt,
        } as Json,
      })
      .eq("nango_connection_id", connectionId);
  }

  return NextResponse.json({
    processed: totalProcessed,
    ...result,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLatestMessageId(messages: DiscordMessage[]): string | null {
  if (messages.length === 0) return null;
  // Discord message IDs are snowflakes — higher ID = newer message
  return messages.reduce((latest, msg) =>
    BigInt(msg.id) > BigInt(latest.id) ? msg : latest
  ).id;
}

// ── Upsert + Process Pipeline ────────────────────────────────────────────────

interface UpsertParams {
  sourceId: string;
  contentType: string;
  title: string;
  content: string;
  sourceMetadata: { [key: string]: Json | undefined };
  sourceCreatedAt: string | null;
}

async function upsertAndProcess(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  params: UpsertParams
): Promise<void> {
  const { sourceId, contentType, title, content, sourceMetadata, sourceCreatedAt } =
    params;

  if (!content || content.trim().length < 10) return;

  // Check for existing
  const { data: existing } = await supabase
    .from("context_items")
    .select("id")
    .eq("org_id", orgId)
    .eq("source_type", "discord")
    .eq("source_id", sourceId)
    .maybeSingle();

  let itemId: string;

  if (existing) {
    await supabase
      .from("context_items")
      .update({
        title,
        raw_content: content,
        content_type: contentType,
        source_metadata: sourceMetadata as Json,
        status: "processing",
      })
      .eq("id", existing.id);
    itemId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("context_items")
      .insert({
        org_id: orgId,
        source_type: "discord",
        source_id: sourceId,
        title,
        raw_content: content,
        content_type: contentType,
        source_metadata: sourceMetadata as Json,
        status: "processing",
        source_created_at: sourceCreatedAt,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(
        `[discord:sync] DB insert error for ${sourceId}:`,
        error?.message
      );
      return;
    }
    itemId = inserted.id;
  }

  // AI extraction + embedding
  try {
    const [extraction, embedding] = await Promise.all([
      extractStructured(content, title),
      generateEmbedding(content),
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
    console.error(`[discord:sync] Pipeline error for ${sourceId}:`, err);
    await supabase
      .from("context_items")
      .update({ status: "error" })
      .eq("id", itemId);
  }
}
