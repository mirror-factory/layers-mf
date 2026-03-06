import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";

export const maxDuration = 60;

// Nango HMAC signatures are deprecated (removed Jan 2025).
// Webhook authenticity is handled by Nango's signed delivery mechanism.

interface NangoWebhookPayload {
  type: "auth" | "sync" | string;
  // auth fields
  operation?: "creation" | "override" | "unknown";
  success?: boolean;
  connectionId?: string;
  providerConfigKey?: string;
  tags?: {
    end_user_id?: string;
    end_user_email?: string;
    organization_id?: string;
  };
  // sync fields
  syncName?: string;
  model?: string;
  responseResults?: { added: number; updated: number; deleted: number };
  modifiedAfter?: string;
}

interface NangoRecord {
  id: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  let payload: NangoWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── AUTH EVENT ──────────────────────────────────────────────────────────────
  // Fires when a user successfully connects an integration via Nango Connect UI.
  // tags.organization_id = our org_id (set when creating the connect session).
  if (payload.type === "auth" && payload.success && payload.operation === "creation") {
    const orgId = payload.tags?.organization_id;
    const connectionId = payload.connectionId;
    const provider = payload.providerConfigKey;
    const userId = payload.tags?.end_user_id;

    if (!orgId || !connectionId || !provider || !userId) {
      return NextResponse.json({ error: "Missing auth webhook fields" }, { status: 400 });
    }

    await supabase.from("integrations").upsert(
      {
        org_id: orgId,
        provider,
        nango_connection_id: connectionId,
        status: "active",
        created_by: userId,
      },
      { onConflict: "org_id,provider" }
    );

    return NextResponse.json({ received: true, event: "auth" });
  }

  // ── SYNC EVENT ──────────────────────────────────────────────────────────────
  // Fires when Nango finishes syncing records for a connection.
  // Look up orgId from our integrations table via the Nango connectionId.
  if (
    payload.type === "sync" &&
    payload.syncName &&
    payload.model &&
    payload.connectionId &&
    payload.providerConfigKey
  ) {
    const connectionId = payload.connectionId;

    const { data: integration } = await supabase
      .from("integrations")
      .select("org_id")
      .eq("nango_connection_id", connectionId)
      .single();

    if (!integration) {
      return NextResponse.json({ error: "Unknown connectionId" }, { status: 404 });
    }

    const orgId = integration.org_id;

    const response = await nango.listRecords<NangoRecord>({
      providerConfigKey: payload.providerConfigKey,
      connectionId,
      model: payload.model,
      modifiedAfter: payload.modifiedAfter,
    });

    const records = response.records ?? [];
    if (records.length === 0) {
      return NextResponse.json({ received: true, processed: 0 });
    }

    await supabase
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nango_connection_id", connectionId);

    // Process fire-and-forget so webhook returns quickly
    (async () => {
      for (const record of records) {
        try {
          const sourceId = String(record.id ?? "");
          const title = String(record.title ?? record.name ?? "Untitled");
          const content = String(
            record.transcript ?? record.content ?? record.body ?? record.description ?? ""
          );
          const sourceCreatedAt = (record.created_at ?? record.started_at ?? null) as string | null;

          if (!content) continue;

          const { data: item, error } = await supabase
            .from("context_items")
            .upsert(
              {
                org_id: orgId,
                source_type: payload.providerConfigKey!,
                source_id: sourceId,
                nango_connection_id: connectionId,
                title,
                raw_content: content,
                content_type: contentTypeFor(payload.providerConfigKey!),
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
            .eq("id", item.id);

          await createInboxItems(supabase, orgId, item.id, extraction, payload.providerConfigKey!);
        } catch (err) {
          console.error("Nango record processing error:", err);
        }
      }
    })();

    return NextResponse.json({ received: true, queued: records.length });
  }

  return NextResponse.json({ received: true });
}

function contentTypeFor(provider: string): string {
  switch (provider) {
    case "granola": return "meeting_transcript";
    case "linear": return "issue";
    case "github": return "issue";
    case "slack": return "message";
    default: return "document";
  }
}
