import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFile } from "@/lib/ingest/parse";
import { processContextItem } from "@/lib/pipeline/process-context";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60; // seconds — allow time for AI processing

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

  // 2. Insert context_item as pending
  const { data: item, error: insertError } = await supabase
    .from("context_items")
    .insert({
      org_id: member.org_id,
      source_type: "upload",
      title: file.name,
      raw_content: parsed.text,
      content_type: parsed.contentType,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !item) {
    return NextResponse.json({ error: "Failed to save item" }, { status: 500 });
  }

  // 3. Run full processing pipeline (extract → embed → link to sessions)
  const result = await processContextItem(supabase, item.id, member.org_id);

  const status = result.status === "ready" ? 200 : 207;
  return NextResponse.json(
    { id: item.id, status: result.status, error: result.error },
    { status }
  );
}
