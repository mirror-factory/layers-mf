import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { parseFile } from "@/lib/ingest/parse";
import { inngest } from "@/lib/inngest/client";
import { rateLimit } from "@/lib/rate-limit";

// No maxDuration needed — processing is now handled async via Inngest

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`upload:${user.id}`, 10, 60_000);
  if (!success) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "X-RateLimit-Remaining": "0" },
    });
  }

  // Get user's org
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  // 1. Parse file → raw text
  let parsed: Awaited<ReturnType<typeof parseFile>>;
  try {
    parsed = await parseFile(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // 2. Insert context_item as pending (with content_hash for dedup)
  const contentHash = createHash("sha256").update(parsed.text).digest("hex");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: insertError } = await (supabase as any)
    .from("context_items")
    .insert({
      org_id: member.org_id,
      source_type: "upload",
      title: file.name,
      raw_content: parsed.text,
      content_type: parsed.contentType,
      content_hash: contentHash,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !item) {
    return NextResponse.json({ error: "Failed to save item" }, { status: 500 });
  }

  // 3. Process: Inngest for production, inline for demo mode
  const demoMode = process.env.DEMO_MODE === "true";

  if (demoMode) {
    // Demo mode: process inline (extract + embed) instead of Inngest
    try {
      const { extractStructured } = await import("@/lib/ai/extract");
      const { generateEmbedding } = await import("@/lib/ai/embed");

      const [extraction, embedding] = await Promise.all([
        extractStructured(parsed.text, file.name),
        generateEmbedding(parsed.text),
      ]);

      await supabase
        .from("context_items")
        .update({
          title: extraction.title,
          description_short: extraction.description_short,
          description_long: extraction.description_long,
          entities: extraction.entities as any,
          embedding: embedding as unknown as string,
          status: "ready",
          processed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      return NextResponse.json({ id: item.id, status: "ready" });
    } catch (err) {
      console.error("Demo mode processing failed:", err);
      await supabase
        .from("context_items")
        .update({ status: "error" })
        .eq("id", item.id);
      return NextResponse.json(
        { id: item.id, status: "error", error: "Processing failed" },
        { status: 207 }
      );
    }
  }

  // Production: emit Inngest event for durable processing pipeline
  await inngest.send({
    name: "context/item.created",
    data: { contextItemId: item.id, orgId: member.org_id },
  });

  return NextResponse.json(
    { id: item.id, status: "accepted" },
    { status: 202 }
  );
}
