import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";
import { fetchDriveChanges, type DriveChangedFile } from "@/lib/integrations/google-drive";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60;

// MIME types we can export as plain text
const GDRIVE_EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

/**
 * Google Drive push notification webhook receiver.
 *
 * Google sends POST requests here when watched Drive resources change.
 * Headers:
 *   X-Goog-Channel-ID: The channel ID we registered
 *   X-Goog-Resource-State: "sync" (initial) | "change" | "update" | etc.
 *   X-Goog-Resource-ID: The resource being watched
 */
export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceState = request.headers.get("x-goog-resource-state");
  const resourceId = request.headers.get("x-goog-resource-id");

  // Validate required Google headers
  if (!channelId || !resourceState) {
    return NextResponse.json({ error: "Missing Google Drive headers" }, { status: 400 });
  }

  // "sync" is the initial verification ping — just acknowledge it
  if (resourceState === "sync") {
    console.log(`[gdrive-webhook] Sync ping for channel=${channelId}`);
    return NextResponse.json({ received: true });
  }

  // Only process "change" events
  if (resourceState !== "change") {
    console.log(`[gdrive-webhook] Ignoring state=${resourceState} for channel=${channelId}`);
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  // Look up the integration by the watch channel ID stored in sync_config
  const { data: integrations } = await supabase
    .from("integrations")
    .select("id, org_id, nango_connection_id, provider, sync_config")
    .eq("provider", "google-drive")
    .eq("status", "active");

  // Find the integration whose sync_config.watch.channelId matches
  const integration = (integrations ?? []).find((i) => {
    const config = i.sync_config as Record<string, Json> | null;
    const watch = config?.watch as Record<string, string> | undefined;
    return watch?.channelId === channelId;
  });

  if (!integration) {
    console.warn(`[gdrive-webhook] No integration found for channel=${channelId}`);
    return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  }

  const { org_id: orgId, nango_connection_id: connectionId, provider } = integration;
  const syncConfig = integration.sync_config as Record<string, Json> | null;
  const startPageToken = syncConfig?.startPageToken as string | undefined;

  if (!startPageToken) {
    console.warn(`[gdrive-webhook] No startPageToken for integration=${integration.id}`);
    return NextResponse.json({ error: "No page token" }, { status: 500 });
  }

  // Process changes in the background so the webhook returns quickly
  processChanges(orgId, connectionId, provider, startPageToken, integration.id).catch((err) =>
    console.error("[gdrive-webhook] Background processing error:", err)
  );

  return NextResponse.json({
    received: true,
    channelId,
    resourceId,
    resourceState,
  });
}

/**
 * Fetch and process changed Drive files through the AI pipeline.
 */
async function processChanges(
  orgId: string,
  connectionId: string,
  provider: string,
  pageToken: string,
  integrationId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Fetch changed files via the incremental changes API
  const { files, newStartPageToken } = await fetchDriveChanges(connectionId, provider, pageToken);

  // Update the page token for next time
  if (newStartPageToken) {
    const { data: current } = await supabase
      .from("integrations")
      .select("sync_config")
      .eq("id", integrationId)
      .single();

    const existingConfig = (current?.sync_config as Record<string, Json>) ?? {};
    await supabase
      .from("integrations")
      .update({
        sync_config: {
          ...existingConfig,
          startPageToken: newStartPageToken,
        },
      })
      .eq("id", integrationId);
  }

  // Filter to exportable files
  const exportable = files.filter((f) => f.mimeType in GDRIVE_EXPORTABLE);
  if (exportable.length === 0) return;

  let processed = 0;

  for (const file of exportable) {
    try {
      await processFile(supabase, file, orgId, connectionId, provider);
      processed++;
    } catch (err) {
      console.error(`[gdrive-webhook] Failed to process file ${file.name}:`, err);
    }
  }

  if (processed > 0) {
    await supabase
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integrationId);
  }

  console.log(
    `[gdrive-webhook] Processed ${processed}/${exportable.length} changed files for org=${orgId}`
  );
}

/**
 * Export a single Drive file and run it through the AI pipeline.
 */
async function processFile(
  supabase: ReturnType<typeof createAdminClient>,
  file: DriveChangedFile,
  orgId: string,
  connectionId: string,
  provider: string
): Promise<void> {
  const exportMime = GDRIVE_EXPORTABLE[file.mimeType];
  if (!exportMime) return;

  const res = await nango.proxy<string>({
    method: "GET",
    providerConfigKey: provider,
    connectionId,
    endpoint: `/drive/v3/files/${file.id}/export`,
    params: { mimeType: exportMime },
  });

  const content = typeof res.data === "string" ? res.data.trim() : "";
  if (content.length < 30) return;

  const sourceMetadata: Json = {
    url: file.webViewLink ?? null,
    mimeType: file.mimeType,
    fileSize: file.size ?? null,
    lastModifiedBy: file.lastModifyingUser?.displayName ?? null,
    modifiedTime: file.modifiedTime ?? null,
  };

  // Upsert the context item
  const { data: existing } = await supabase
    .from("context_items")
    .select("id")
    .eq("org_id", orgId)
    .eq("source_type", provider)
    .eq("source_id", file.id)
    .maybeSingle();

  let itemId: string;

  if (existing) {
    await supabase
      .from("context_items")
      .update({
        status: "processing",
        raw_content: content.slice(0, 12000),
        title: file.name,
        source_metadata: sourceMetadata,
      })
      .eq("id", existing.id);
    itemId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("context_items")
      .insert({
        org_id: orgId,
        source_type: provider,
        source_id: file.id,
        nango_connection_id: connectionId,
        title: file.name,
        raw_content: content.slice(0, 12000),
        content_type: "document",
        status: "processing",
        source_created_at: file.createdTime ?? null,
        source_metadata: sourceMetadata,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error(`[gdrive-webhook] Insert failed for ${file.name}:`, error?.message);
      return;
    }
    itemId = inserted.id;
  }

  // AI extraction + embedding
  const [extraction, embedding] = await Promise.all([
    extractStructured(content.slice(0, 12000), file.name),
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

  await createInboxItems(supabase, orgId, itemId, extraction, provider);
}
