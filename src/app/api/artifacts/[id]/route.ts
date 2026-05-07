import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logArtifactInteraction } from "@/lib/interactions/artifact-tracker";

/**
 * GET /api/artifacts/[id] — Get full artifact with current content and files
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: artifact, error } = await sb
    .from("artifacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get files for current version
  const { data: files } = await sb
    .from("artifact_files")
    .select("file_path, content, language, size_bytes")
    .eq("artifact_id", id)
    .eq("version_number", artifact.current_version)
    .order("file_path");

  // Update last_opened_at
  await sb.from("artifacts").update({ last_opened_at: new Date().toISOString() }).eq("id", id);

  // Log viewed interaction
  logArtifactInteraction({
    artifactId: id,
    userId: user.id,
    type: "viewed",
  });

  return NextResponse.json({
    ...artifact,
    files: files ?? [],
  });
}

/**
 * PATCH /api/artifacts/[id] — Update artifact metadata (title, tags, status, content)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = ["title", "description_oneliner", "description_short", "description_long", "tags", "categories", "status", "is_pinned", "content"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("artifacts")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/artifacts/[id] — Soft delete (set status to 'deleted')
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("artifacts")
    .update({ status: "deleted" })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
