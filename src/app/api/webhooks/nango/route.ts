import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";

export const maxDuration = 60;

function verifySignature(body: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// Nango sync webhook payload
interface NangoSyncWebhook {
  type: "sync" | "auth";
  connectionId: string;
  providerConfigKey: string; // e.g. "granola", "linear"
  syncName?: string;
  model?: string;
  responseResults?: { added: number; updated: number; deleted: number };
  syncType?: string;
  modifiedAfter?: string;
}

// Shape of records returned by Nango for each integration
interface NangoRecord {
  id: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-nango-signature") ?? "";
  const secret = process.env.NANGO_WEBHOOK_SECRET ?? "";

  if (secret && !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: NangoSyncWebhook;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle sync events (not auth/connection events)
  if (payload.type !== "sync" || !payload.syncName || !payload.model) {
    return NextResponse.json({ received: true });
  }

  // connectionId == our org_id (we set it that way in the Nango connect flow)
  const orgId = payload.connectionId;
  if (!orgId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  // Fetch new/updated records from Nango
  const response = await nango.listRecords<NangoRecord>({
    providerConfigKey: payload.providerConfigKey,
    connectionId: orgId,
    model: payload.model,
    modifiedAfter: payload.modifiedAfter,
  });

  const records = response.records ?? [];
  if (records.length === 0) {
    return NextResponse.json({ received: true, processed: 0 });
  }

  const supabase = createAdminClient();

  // Process records async (fire and forget — webhook must respond quickly)
  (async () => {
    for (const record of records) {
      try {
        const sourceId = String(record.id ?? "");
        const title = String(record.title ?? record.name ?? "Untitled");
        const content = String(record.transcript ?? record.content ?? record.body ?? record.description ?? "");
        const sourceCreatedAt = (record.created_at ?? record.started_at ?? null) as string | null;

        if (!content) continue;

        const { data: item, error } = await supabase
          .from("context_items")
          .upsert(
            {
              org_id: orgId,
              source_type: payload.providerConfigKey,
              source_id: sourceId,
              title,
              raw_content: content,
              content_type: contentTypeFor(payload.providerConfigKey),
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
      } catch (err) {
        console.error("Nango record processing error:", err);
      }
    }
  })();

  return NextResponse.json({ received: true, queued: records.length });
}

function contentTypeFor(providerConfigKey: string): string {
  switch (providerConfigKey) {
    case "granola": return "meeting_transcript";
    case "linear": return "issue";
    case "google-drive": return "document";
    default: return "document";
  }
}
