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
 * POST /api/artifacts/[id]/versions — Restore a specific version
 * Body: { version_number: number }
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
  const targetVersion = body.version_number as number;
  if (!targetVersion) return NextResponse.json({ error: "version_number required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Get the target version's content
  const { data: version } = await sb
    .from("artifact_versions")
    .select("content, snapshot_id")
    .eq("artifact_id", id)
    .eq("version_number", targetVersion)
    .single();

  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Get the target version's files
  const { data: files } = await sb
    .from("artifact_files")
    .select("file_path, content, language, size_bytes")
    .eq("artifact_id", id)
    .eq("version_number", targetVersion);

  // Get current version number
  const { data: artifact } = await sb
    .from("artifacts")
    .select("current_version")
    .eq("id", id)
    .single();

  const newVersion = (artifact?.current_version ?? 0) + 1;

  // Create a new version that's a restore
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

  // Copy files from target version to new version
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

  // Update artifact
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
