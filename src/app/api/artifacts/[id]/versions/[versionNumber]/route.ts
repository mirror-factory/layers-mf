import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/artifacts/[id]/versions/[versionNumber] — Get a specific version's content
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionNumber: string }> },
) {
  const { id, versionNumber } = await params;
  const vNum = parseInt(versionNumber, 10);
  if (isNaN(vNum)) return NextResponse.json({ error: "Invalid version number" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: version, error } = await sb
    .from("artifact_versions")
    .select("id, version_number, content, snapshot_id, change_summary, change_type, created_at")
    .eq("artifact_id", id)
    .eq("version_number", vNum)
    .single();

  if (error || !version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Also get files for this version
  const { data: files } = await sb
    .from("artifact_files")
    .select("file_path, content, language, size_bytes")
    .eq("artifact_id", id)
    .eq("version_number", vNum)
    .order("file_path");

  return NextResponse.json({
    ...version,
    files: files ?? [],
  });
}

/**
 * DELETE /api/artifacts/[id]/versions/[versionNumber] — Delete a specific version
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionNumber: string }> },
) {
  const { id, versionNumber } = await params;
  const vNum = parseInt(versionNumber, 10);
  if (isNaN(vNum)) return NextResponse.json({ error: "Invalid version number" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Don't allow deleting the current/latest version
  const { data: artifact } = await sb
    .from("artifacts")
    .select("current_version")
    .eq("id", id)
    .single();

  if (artifact && artifact.current_version === vNum) {
    return NextResponse.json({ error: "Cannot delete the current version" }, { status: 400 });
  }

  // Delete version files first, then the version record
  await sb.from("artifact_files").delete().eq("artifact_id", id).eq("version_number", vNum);
  await sb.from("artifact_versions").delete().eq("artifact_id", id).eq("version_number", vNum);

  return NextResponse.json({ deleted: true, version_number: vNum });
}
