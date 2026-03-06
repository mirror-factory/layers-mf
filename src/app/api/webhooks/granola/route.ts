import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-granola-signature") ?? "";
  const secret = process.env.GRANOLA_WEBHOOK_SECRET ?? "";

  if (secret && !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Granola webhook payload shape (adapt as their API evolves)
  const event = payload.event as string;
  if (!event?.startsWith("meeting.")) {
    return NextResponse.json({ received: true }); // ignore non-meeting events
  }

  const data = (payload.data ?? {}) as Record<string, unknown>;
  const sourceId = (data.id ?? data.meeting_id ?? "") as string;
  const title = (data.title ?? "Untitled Meeting") as string;
  const transcript = (data.transcript ?? data.content ?? "") as string;
  const orgId = (data.org_id ?? payload.org_id ?? "") as string;
  const sourceCreatedAt = (data.created_at ?? data.started_at ?? null) as string | null;

  if (!orgId || !transcript) {
    return NextResponse.json({ error: "Missing org_id or transcript" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Upsert to avoid duplicates on replay (unique index: org_id, source_type, source_id)
  const { data: item, error: insertError } = await supabase
    .from("context_items")
    .upsert(
      {
        org_id: orgId,
        source_type: "granola",
        source_id: sourceId,
        title,
        raw_content: transcript,
        content_type: "meeting_transcript",
        status: "processing",
        source_created_at: sourceCreatedAt,
      },
      { onConflict: "org_id,source_type,source_id" }
    )
    .select()
    .single();

  if (insertError || !item) {
    console.error("Granola insert error:", insertError);
    return NextResponse.json({ error: "Failed to save item" }, { status: 500 });
  }

  // Process async (fire and forget — webhook must respond quickly)
  (async () => {
    try {
      const [extraction, embedding] = await Promise.all([
        extractStructured(transcript, title),
        generateEmbedding(transcript),
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
      console.error("Granola processing error:", err);
      await supabase
        .from("context_items")
        .update({ status: "error" })
        .eq("id", item.id);
    }
  })();

  return NextResponse.json({ received: true, id: item.id });
}
