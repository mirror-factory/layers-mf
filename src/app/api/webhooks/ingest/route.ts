import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { processContextItem } from "@/lib/pipeline/process-context";
import {
  parseGranolaPayload,
  verifyGranolaToken,
  buildGranolaMetadata,
} from "@/lib/integrations/granola";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Route to Granola-specific handler if source is 'granola'
  if (body.source === "granola") {
    return handleGranolaIngest(request, body);
  }

  // Generic webhook ingest (existing behavior)
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Auto-trigger processing pipeline (fire-and-forget)
  processContextItem(adminDb, data.id, org_id).catch((err) =>
    console.error("Pipeline auto-trigger failed:", err)
  );

  return NextResponse.json({ id: data.id, status: "accepted" });
}

/**
 * Handle Granola-specific webhook payloads.
 * Accepts both GRANOLA_WEBHOOK_TOKEN (Authorization header) and WEBHOOK_SECRET (x-webhook-secret).
 */
async function handleGranolaIngest(request: NextRequest, body: unknown) {
  // Auth: accept either Granola-specific token or general webhook secret
  const granolaAuth = verifyGranolaToken(
    request.headers.get("authorization")
  );
  const generalAuth =
    request.headers.get("x-webhook-secret") === process.env.WEBHOOK_SECRET;

  if (!granolaAuth && !generalAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate Granola payload
  let payload;
  try {
    payload = parseGranolaPayload(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Granola payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // org_id must be provided alongside Granola payloads
  const orgId = (body as Record<string, unknown>).org_id;
  if (!orgId || typeof orgId !== "string") {
    return NextResponse.json(
      { error: "Missing required field: org_id" },
      { status: 400 }
    );
  }

  const adminDb = createAdminClient();

  const { data, error } = await adminDb
    .from("context_items")
    .insert({
      org_id: orgId,
      title: payload.metadata.title,
      raw_content: payload.content,
      source_type: "granola",
      content_type: "meeting_transcript",
      status: "pending",
      source_metadata: buildGranolaMetadata(payload.metadata),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-trigger processing pipeline
  processContextItem(adminDb, data.id, orgId).catch((err) =>
    console.error("Granola pipeline auto-trigger failed:", err)
  );

  return NextResponse.json({ id: data.id, status: "accepted" });
}
