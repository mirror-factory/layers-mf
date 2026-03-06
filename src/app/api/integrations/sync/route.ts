import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";

export const maxDuration = 60;

interface RawRecord {
  id: string;
  title: string;
  content: string;
  sourceCreatedAt?: string | null;
}

// ── GitHub ─────────────────────────────────────────────────────────────────
async function fetchGitHub(
  provider: string,
  connectionId: string
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];

  // Fetch repos the token has access to
  let repos: { full_name: string; name: string }[] = [];
  try {
    const res = await nango.proxy<{ full_name: string; name: string }[]>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/user/repos",
      params: { per_page: "10", sort: "pushed" },
    });
    repos = res.data ?? [];
  } catch (err) {
    console.error("[sync:github] repos fetch failed:", err);
    return [];
  }

  for (const repo of repos.slice(0, 4)) {
    try {
      const res = await nango.proxy<
        { number: number; title: string; body: string | null; created_at: string }[]
      >({
        method: "GET",
        providerConfigKey: provider,
        connectionId,
        endpoint: `/repos/${repo.full_name}/issues`,
        params: { per_page: "15", state: "all" },
      });

      for (const issue of (res.data ?? []).slice(0, 8)) {
        if (!issue.body) continue;
        records.push({
          id: `${repo.full_name}#${issue.number}`,
          title: `[${repo.name}] ${issue.title}`,
          content: issue.body.slice(0, 12000),
          sourceCreatedAt: issue.created_at,
        });
      }
    } catch {
      // repo might have no issues / no access — skip
    }
  }

  return records.slice(0, 20);
}

// ── Google Drive ────────────────────────────────────────────────────────────
// MIME types we can export as plain text
const GDRIVE_EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

async function fetchGoogleDrive(
  provider: string,
  connectionId: string
): Promise<{ records: RawRecord[]; debug: string[] }> {
  const records: RawRecord[] = [];
  const debug: string[] = [];

  let files: { id: string; name: string; mimeType: string; createdTime?: string }[] = [];
  try {
    const res = await nango.proxy<{
      files: { id: string; name: string; mimeType: string; createdTime?: string }[];
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/files",
      params: {
        q: "trashed=false",
        fields: "files(id,name,mimeType,createdTime)",
        pageSize: "30",
        orderBy: "modifiedTime desc",
      },
    });
    files = res.data?.files ?? [];
    debug.push(`Found ${files.length} files in Drive`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debug.push(`Drive API error: ${msg}`);
    return { records, debug };
  }

  for (const file of files.slice(0, 15)) {
    const exportMime = GDRIVE_EXPORTABLE[file.mimeType];
    if (!exportMime) {
      const friendly = file.mimeType.split(".").pop() ?? file.mimeType;
      debug.push(`Skipped: ${file.name} (${friendly} — not exportable)`);
      continue;
    }
    try {
      const res = await nango.proxy<string>({
        method: "GET",
        providerConfigKey: provider,
        connectionId,
        endpoint: `/drive/v3/files/${file.id}/export`,
        params: { mimeType: exportMime },
      });
      const content = typeof res.data === "string" ? res.data.trim() : "";
      if (content.length < 30) {
        debug.push(`Skipped: ${file.name} (empty content)`);
        continue;
      }
      debug.push(`Imported: ${file.name} (${content.length} chars)`);
      records.push({
        id: file.id,
        title: file.name,
        content: content.slice(0, 12000),
        sourceCreatedAt: file.createdTime ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debug.push(`Failed: ${file.name} — ${msg}`);
    }
  }

  return { records, debug };
}

// ── Slack ───────────────────────────────────────────────────────────────────
async function fetchSlack(
  provider: string,
  connectionId: string
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];

  let channels: { id: string; name: string }[] = [];
  try {
    const res = await nango.proxy<{
      channels: { id: string; name: string }[];
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/api/conversations.list",
      params: { types: "public_channel", limit: "10" },
    });
    channels = res.data?.channels ?? [];
  } catch (err) {
    console.error("[sync:slack] channels fetch failed:", err);
    return [];
  }

  for (const channel of channels.slice(0, 3)) {
    try {
      const res = await nango.proxy<{
        messages: { ts: string; text?: string; user?: string }[];
      }>({
        method: "GET",
        providerConfigKey: provider,
        connectionId,
        endpoint: "/api/conversations.history",
        params: { channel: channel.id, limit: "50" },
      });

      const msgs = (res.data?.messages ?? [])
        .filter((m) => m.text && m.text.length > 20)
        .map((m) => m.text!)
        .join("\n\n");

      if (msgs.length < 50) continue;

      records.push({
        id: `slack-${channel.id}`,
        title: `#${channel.name} — recent messages`,
        content: msgs.slice(0, 12000),
      });
    } catch {
      // skip inaccessible channels
    }
  }

  return records;
}

function contentTypeFor(provider: string): string {
  if (provider.includes("github")) return "issue";
  switch (provider) {
    case "google-drive": return "document";
    case "slack":        return "message";
    case "linear":       return "issue";
    case "granola":      return "meeting_transcript";
    default:             return "document";
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connectionId: string, provider: string;
  try {
    const body = await request.json();
    connectionId = body.connectionId;
    provider = body.provider;
    if (!connectionId || !provider) throw new Error("missing");
  } catch {
    return NextResponse.json({ error: "connectionId and provider required" }, { status: 400 });
  }

  // Verify the integration belongs to the user's org (RLS scoped)
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id")
    .eq("nango_connection_id", connectionId)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const orgId = integration.org_id;
  const adminDb = createAdminClient();

  // Fetch raw records from the provider via Nango proxy
  let rawRecords: RawRecord[] = [];
  let debugLines: string[] = [];

  if (provider.includes("github")) {
    rawRecords = await fetchGitHub(provider, connectionId);
  } else if (provider === "google-drive") {
    const result = await fetchGoogleDrive(provider, connectionId);
    rawRecords = result.records;
    debugLines = result.debug;
  } else if (provider === "slack") {
    rawRecords = await fetchSlack(provider, connectionId);
  } else {
    return NextResponse.json({ error: `No fetch strategy for provider: ${provider}` }, { status: 400 });
  }

  if (rawRecords.length === 0) {
    return NextResponse.json({ processed: 0, debug: debugLines });
  }

  const contentType = contentTypeFor(provider);
  let processed = 0;

  for (const record of rawRecords) {
    try {
      const { data: item, error } = await adminDb
        .from("context_items")
        .upsert(
          {
            org_id: orgId,
            source_type: provider,
            source_id: record.id,
            nango_connection_id: connectionId,
            title: record.title,
            raw_content: record.content,
            content_type: contentType,
            status: "processing",
            source_created_at: record.sourceCreatedAt ?? null,
          },
          { onConflict: "org_id,source_type,source_id" }
        )
        .select()
        .single();

      if (error || !item) continue;

      const [extraction, embedding] = await Promise.all([
        extractStructured(record.content, record.title),
        generateEmbedding(record.content),
      ]);

      await adminDb
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
        .eq("id", item.id);

      await createInboxItems(adminDb, orgId, item.id, extraction, provider);
      processed++;
    } catch (err) {
      console.error(`[sync] processing error for ${record.id}:`, err);
    }
  }

  if (processed > 0) {
    await adminDb
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nango_connection_id", connectionId);
  }

  return NextResponse.json({ processed, fetched: rawRecords.length, debug: debugLines });
}
