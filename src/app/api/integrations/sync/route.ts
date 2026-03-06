import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";

export const maxDuration = 60;

// Model names Nango uses per provider (try each; skip if no records returned)
const PROVIDER_MODELS: Record<string, string[]> = {
  "github":       ["Issue", "PullRequest", "GithubIssue", "Repository", "GithubRepoFile"],
  "github-app":   ["Issue", "PullRequest", "GithubIssue", "Repository", "GithubRepoFile"],
  "google-drive": ["GoogleDriveDocument", "Document", "File"],
  "slack":        ["Message", "SlackMessage", "Channel"],
  "linear":       ["Issue", "LinearIssue"],
  "granola":      ["Meeting", "Transcript"],
};

function contentTypeFor(provider: string): string {
  if (provider.startsWith("github")) return "issue";
  switch (provider) {
    case "google-drive": return "document";
    case "slack":        return "message";
    case "linear":       return "issue";
    case "granola":      return "meeting_transcript";
    default:             return "document";
  }
}

interface NangoRecord {
  id: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  // Auth
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

  // Verify this integration belongs to user's org (RLS handles this)
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
  const contentType = contentTypeFor(provider);

  const models = PROVIDER_MODELS[provider] ?? ["Document"];
  let totalProcessed = 0;
  const modelResults: Record<string, number> = {};

  for (const model of models) {
    let records: NangoRecord[] = [];
    try {
      const response = await nango.listRecords<NangoRecord>({
        providerConfigKey: provider,
        connectionId,
        model,
      });
      records = response.records ?? [];
    } catch {
      // Model not configured for this connection — skip
      continue;
    }

    if (records.length === 0) continue;

    let processed = 0;
    for (const record of records) {
      try {
        const sourceId = String(record.id ?? "");
        const title = String(record.title ?? record.name ?? record.subject ?? "Untitled");
        const content = String(
          record.transcript ?? record.content ?? record.body ?? record.description ?? record.text ?? ""
        );
        const sourceCreatedAt = (record.created_at ?? record.started_at ?? null) as string | null;

        if (!content) continue;

        const { data: item, error } = await adminDb
          .from("context_items")
          .upsert(
            {
              org_id: orgId,
              source_type: provider,
              source_id: sourceId,
              nango_connection_id: connectionId,
              title,
              raw_content: content,
              content_type: contentType,
              status: "processing",
              source_created_at: sourceCreatedAt,
            },
            { onConflict: "org_id,source_type,source_id" }
          )
          .select()
          .single();

        if (error || !item) continue;

        const [extraction, embedding] = await Promise.all([
          extractStructured(content, title),
          generateEmbedding(content),
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
        console.error(`[sync] record processing error (${model}):`, err);
      }
    }

    if (processed > 0) {
      modelResults[model] = processed;
      totalProcessed += processed;
    }
  }

  // Update last_sync_at
  if (totalProcessed > 0) {
    await adminDb
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nango_connection_id", connectionId);
  }

  return NextResponse.json({ processed: totalProcessed, models: modelResults });
}
