import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/artifacts/[id]/versions — List all versions of an artifact
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

  const { data: versions, error } = await sb
    .from("artifact_versions")
    .select("id, version_number, change_summary, change_type, cost_usd, input_tokens, output_tokens, created_by_ai, model_used, created_at")
    .eq("artifact_id", id)
    .order("version_number", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ versions: versions ?? [] });
}

/**
 * POST /api/artifacts/[id]/versions
 *
 * Two modes:
 * 1. Restore: { version_number: number } — restores a previous version
 * 2. Create:  { content: string, change_type?: string, change_summary?: string } — creates a new version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Get current version number
  const { data: artifact } = await sb
    .from("artifacts")
    .select("current_version")
    .eq("id", id)
    .single();

  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  const newVersion = (artifact.current_version ?? 0) + 1;

  // --- Mode 1: Restore a previous version ---
  if (body.version_number) {
    const targetVersion = body.version_number as number;

    const { data: version } = await sb
      .from("artifact_versions")
      .select("content, snapshot_id")
      .eq("artifact_id", id)
      .eq("version_number", targetVersion)
      .single();

    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

    const { data: files } = await sb
      .from("artifact_files")
      .select("file_path, content, language, size_bytes")
      .eq("artifact_id", id)
      .eq("version_number", targetVersion);

    await sb.from("artifact_versions").insert({
      artifact_id: id,
      version_number: newVersion,
      content: version.content,
      snapshot_id: version.snapshot_id,
      change_summary: `Restored to version ${targetVersion}`,
      change_type: "restore",
      created_by: user.id,
      created_by_ai: false,
    });

    if (files && files.length > 0) {
      await sb.from("artifact_files").insert(
        files.map((f: { file_path: string; content: string; language: string; size_bytes: number }) => ({
          artifact_id: id,
          version_number: newVersion,
          file_path: f.file_path,
          content: f.content,
          language: f.language,
          size_bytes: f.size_bytes,
        })),
      );
    }

    await sb.from("artifacts").update({
      current_version: newVersion,
      content: version.content,
      snapshot_id: version.snapshot_id,
    }).eq("id", id);

    return NextResponse.json({
      restored: true,
      from_version: targetVersion,
      new_version: newVersion,
    });
  }

  // --- Mode 2: Create a new version from provided content ---
  const content = body.content as string | undefined;
  if (!content) return NextResponse.json({ error: "content or version_number required" }, { status: 400 });

  const changeType = (body.change_type as string) ?? "manual_edit";
  const changeSummary = (body.change_summary as string) ?? null;

  await sb.from("artifact_versions").insert({
    artifact_id: id,
    version_number: newVersion,
    content,
    change_summary: changeSummary,
    change_type: changeType,
    created_by: user.id,
    created_by_ai: false,
  });

  await sb.from("artifacts").update({
    current_version: newVersion,
    content,
  }).eq("id", id);

  return NextResponse.json({
    created: true,
    new_version: newVersion,
  });
}
