import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { inngest } from "@/lib/inngest/client";
import { mapNangoRecord } from "@/lib/integrations/nango-mappers";
import {
  computeContentHash,
  detectChanges,
  createVersion,
} from "@/lib/versioning";

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
  // This is the primary ingestion path: fetch records, map, dedupe, and
  // dispatch to the Inngest pipeline for async processing.
  if (
    payload.type === "sync" &&
    payload.syncName &&
    payload.model &&
    payload.connectionId &&
    payload.providerConfigKey
  ) {
    const connectionId = payload.connectionId;
    const provider = payload.providerConfigKey;

    // 1. Look up the integration to get org_id
    const { data: integration } = await supabase
      .from("integrations")
      .select("org_id")
      .eq("nango_connection_id", connectionId)
      .single();

    if (!integration) {
      console.error(
        `[nango-webhook] Unknown connectionId: ${connectionId} (provider: ${provider})`
      );
      return NextResponse.json({ error: "Unknown connectionId" }, { status: 404 });
    }

    const orgId = integration.org_id;

    // 2. Fetch the synced records from Nango
    let records: NangoRecord[] = [];
    try {
      const response = await nango.listRecords<NangoRecord>({
        providerConfigKey: provider,
        connectionId,
        model: payload.model,
        modifiedAfter: payload.modifiedAfter,
      });
      records = response.records ?? [];
    } catch (err) {
      console.error(
        `[nango-webhook] Failed to fetch records from Nango:`,
        err instanceof Error ? err.message : err
      );
      // Return 200 so Nango doesn't retry — the records will come in next sync
      return NextResponse.json({ received: true, error: "fetch_failed", processed: 0 });
    }

    if (records.length === 0) {
      return NextResponse.json({ received: true, processed: 0 });
    }

    console.log(
      `[nango-webhook] Processing ${records.length} records from ${provider} (sync: ${payload.syncName}, connection: ${connectionId})`
    );

    // 3. Update last_sync_at on the integration
    await supabase
      .from("integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("nango_connection_id", connectionId);

    // 4. Map, dedupe, insert, and dispatch to Inngest
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const inngestEvents: { name: string; data: Record<string, unknown> }[] = [];

    for (const record of records) {
      try {
        // Map the raw Nango record to our schema
        const mapped = mapNangoRecord(provider, record as Record<string, unknown>);
        if (!mapped) {
          skipped++;
          continue;
        }

        // Check for existing record (idempotency)
        const { data: existing } = await supabase
          .from("context_items")
          .select("id, raw_content, content_hash, title, source_metadata")
          .eq("org_id", orgId)
          .eq("source_type", provider)
          .eq("source_id", mapped.source_id)
          .maybeSingle();

        if (existing) {
          // Detect what changed using content-hash comparison
          const changes = detectChanges(
            {
              raw_content: existing.raw_content as string | null,
              content_hash: existing.content_hash as string | null,
              title: existing.title as string,
              source_metadata: (existing.source_metadata as Record<string, unknown> | null),
            },
            {
              raw_content: mapped.raw_content,
              title: mapped.title,
              source_metadata: mapped.source_metadata,
            }
          );

          if (!changes.changed) {
            skipped++;
            continue;
          }

          // Version the old state before overwriting
          await createVersion(
            supabase,
            existing.id,
            orgId,
            {
              title: existing.title as string,
              raw_content: existing.raw_content as string | null,
              content_hash: existing.content_hash as string | null,
              source_metadata: existing.source_metadata,
            },
            changes.changeType,
            changes.changedFields,
            `webhook:${provider}`
          );

          if (changes.contentChanged) {
            // Content changed — update and re-process via Inngest
            await supabase
              .from("context_items")
              .update({
                raw_content: mapped.raw_content,
                title: mapped.title,
                status: "pending",
                content_hash: computeContentHash(mapped.raw_content),
                updated_at: new Date().toISOString(),
                source_metadata: mapped.source_metadata as import("@/lib/database.types").Json ?? undefined,
                source_created_at: mapped.source_created_at,
              })
              .eq("id", existing.id);

            inngestEvents.push({
              name: "context/item.created",
              data: { contextItemId: existing.id, orgId },
            });
            updated++;
          } else {
            // Metadata-only change — update metadata, skip expensive AI re-processing
            await supabase
              .from("context_items")
              .update({
                title: mapped.title,
                updated_at: new Date().toISOString(),
                source_metadata: mapped.source_metadata as import("@/lib/database.types").Json ?? undefined,
              })
              .eq("id", existing.id);
            updated++;
          }
        } else {
          // New record — insert with content hash
          const { data: inserted, error } = await supabase
            .from("context_items")
            .insert({
              org_id: orgId,
              source_type: provider,
              source_id: mapped.source_id,
              nango_connection_id: connectionId,
              title: mapped.title,
              raw_content: mapped.raw_content,
              content_type: mapped.content_type,
              content_hash: computeContentHash(mapped.raw_content),
              status: "pending",
              source_created_at: mapped.source_created_at,
              source_metadata: mapped.source_metadata as import("@/lib/database.types").Json ?? undefined,
            })
            .select("id")
            .single();

          if (error || !inserted) {
            console.error(
              `[nango-webhook] DB insert failed for ${provider}/${mapped.source_id}:`,
              error?.message ?? "no row returned"
            );
            continue;
          }

          inngestEvents.push({
            name: "context/item.created",
            data: { contextItemId: inserted.id, orgId },
          });
          created++;
        }
      } catch (err) {
        console.error(
          `[nango-webhook] Error processing record ${record.id} from ${provider}:`,
          err instanceof Error ? err.message : err
        );
        // Continue processing remaining records
      }
    }

    // 5. Send all Inngest events in a single batch
    if (inngestEvents.length > 0) {
      try {
        await inngest.send(inngestEvents);
        console.log(
          `[nango-webhook] Dispatched ${inngestEvents.length} events to Inngest (${created} new, ${updated} updated)`
        );
      } catch (err) {
        console.error(
          `[nango-webhook] Failed to send Inngest events:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    console.log(
      `[nango-webhook] Done: ${created} created, ${updated} updated, ${skipped} skipped (provider: ${provider})`
    );

    return NextResponse.json({
      received: true,
      created,
      updated,
      skipped,
      total: records.length,
    });
  }

  return NextResponse.json({ received: true });
}
