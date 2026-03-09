import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, content, source_type, org_id, metadata } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });
  }
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Missing required field: content" }, { status: 400 });
  }
  if (!source_type || typeof source_type !== "string") {
    return NextResponse.json({ error: "Missing required field: source_type" }, { status: 400 });
  }
  if (!org_id || typeof org_id !== "string") {
    return NextResponse.json({ error: "Missing required field: org_id" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  const { data, error } = await adminDb
    .from("context_items")
    .insert({
      org_id,
      title,
      raw_content: content,
      source_type,
      content_type: "document",
      status: "pending",
      source_metadata: metadata ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: "accepted" });
}
