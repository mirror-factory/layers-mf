import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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
 * POST handler for manual + scheduled incremental Google Drive sync.
 *
 * - If a startPageToken exists in sync_config, performs incremental sync
 * - Otherwise, falls back to a full sync of all exportable files
 * - Updates the page token after each sync
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connectionId: string, provider: string;
  try {
    const body = await request.json();
    connectionId = body.connectionId;
    provider = body.provider ?? "google-drive";
    if (!connectionId) throw new Error("missing");
  } catch {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  // Verify the integration belongs to the user's org
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, org_id, sync_config")
    .eq("nango_connection_id", connectionId)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const orgId = integration.org_id;
  const adminDb = createAdminClient();
  const syncConfig = (integration.sync_config as Record<string, Json>) ?? {};
  const existingPageToken = syncConfig.startPageToken as string | undefined;

  // Incremental sync if we have a page token
  if (existingPageToken) {
    return handleIncrementalSync(
      adminDb,
      orgId,
      connectionId,
      provider,
      existingPageToken,
      integration.id,
      syncConfig
    );
  }

  // Fall back to full sync
  return handleFullSync(adminDb, orgId, connectionId, provider, integration.id, syncConfig);
}

/**
 * Incremental sync: only fetch files changed since last page token.
 */
async function handleIncrementalSync(
  adminDb: ReturnType<typeof createAdminClient>,
  orgId: string,
  connectionId: string,
  provider: string,
  pageToken: string,
  integrationId: string,
  existingSyncConfig: Record<string, Json>
): Promise<NextResponse> {
  const debugLines: string[] = [];

  try {
    const { files, newStartPageToken } = await fetchDriveChanges(connectionId, provider, pageToken);

    // Update page token
    if (newStartPageToken) {
      await adminDb
        .from("integrations")
        .update({
          sync_config: { ...existingSyncConfig, startPageToken: newStartPageToken },
        })
        .eq("id", integrationId);
    }

    const exportable = files.filter((f) => f.mimeType in GDRIVE_EXPORTABLE);
    debugLines.push(`Incremental sync: ${files.length} changes, ${exportable.length} exportable`);

    if (exportable.length === 0) {
      return NextResponse.json({ processed: 0, mode: "incremental", debug: debugLines });
    }

    let processed = 0;
    for (const file of exportable) {
      try {
        await processFile(adminDb, file, orgId, connectionId, provider);
        debugLines.push(`Synced: ${file.name}`);
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLines.push(`Failed: ${file.name} — ${msg}`);
      }
    }

    if (processed > 0) {
      await adminDb
        .from("integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integrationId);
    }

    return NextResponse.json({
      processed,
      fetched: exportable.length,
      mode: "incremental",
      debug: debugLines,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLines.push(`Incremental sync error: ${msg}`);
    return NextResponse.json({ error: msg, debug: debugLines }, { status: 500 });
  }
}

/**
 * Full sync: list all exportable files and process them.
 * Also acquires a startPageToken for future incremental syncs.
 */
async function handleFullSync(
  adminDb: ReturnType<typeof createAdminClient>,
  orgId: string,
  connectionId: string,
  provider: string,
  integrationId: string,
  existingSyncConfig: Record<string, Json>
): Promise<NextResponse> {
  const debugLines: string[] = [];

  // Get a start page token for future incremental syncs
  try {
    const tokenRes = await nango.proxy<{ startPageToken: string }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/changes/startPageToken",
    });

    await adminDb
      .from("integrations")
      .update({
        sync_config: { ...existingSyncConfig, startPageToken: tokenRes.data.startPageToken },
      })
      .eq("id", integrationId);

    debugLines.push(`Acquired startPageToken for future incremental syncs`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLines.push(`Warning: Could not get startPageToken: ${msg}`);
  }

  // List all exportable files with rich metadata
  let files: DriveChangedFile[] = [];
  try {
    const res = await nango.proxy<{
      files: DriveChangedFile[];
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/files",
      params: {
        q: "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation')",
        fields:
          "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,size,lastModifyingUser(displayName,emailAddress))",
        pageSize: "100",
        orderBy: "modifiedTime desc",
      },
    });
    files = res.data?.files ?? [];
    debugLines.push(`Full sync: found ${files.length} exportable files`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLines.push(`Drive API error: ${msg}`);
    return NextResponse.json({ error: msg, debug: debugLines }, { status: 500 });
  }

  let processed = 0;
  for (const file of files) {
    try {
      await processFile(adminDb, file, orgId, connectionId, provider);
      debugLines.push(`Synced: ${file.name}`);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLines.push(`Failed: ${file.name} — ${msg}`);
    }
  }

  if (processed > 0) {
    await adminDb
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integrationId);
  }

  return NextResponse.json({
    processed,
    fetched: files.length,
    mode: "full",
    debug: debugLines,
  });
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

  // Check if already exists
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
      throw new Error(`DB insert failed: ${error?.message ?? "no row returned"}`);
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
