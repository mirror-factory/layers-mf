import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ artifactId: string }> };

async function getAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  return member?.org_id ? { supabase, user, orgId: member.org_id } : null;
}

/**
 * GET /api/sandbox/[artifactId] — Check if sandbox is alive
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { artifactId } = await ctx.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: artifact } = await (auth.supabase as any)
    .from("artifacts")
    .select("preview_url, snapshot_id, run_command, expose_port")
    .eq("id", artifactId)
    .eq("org_id", auth.orgId)
    .single();

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sandboxName = artifact.snapshot_id ?? `layers-${auth.orgId.slice(0, 8)}`;
  try {
    const { Sandbox } = await import("@vercel/sandbox");
    const sb = await Sandbox.get({ name: sandboxName });
    return NextResponse.json({
      status: "running",
      previewUrl: artifact.preview_url,
      cpuUsageMs: sb.activeCpuUsageMs ?? 0,
      networkTransfer: sb.networkTransfer ?? { ingress: 0, egress: 0 },
    });
  } catch {
    return NextResponse.json({ status: "stopped", previewUrl: null });
  }
}

/**
 * POST /api/sandbox/[artifactId] — Start or restart sandbox
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { artifactId } = await ctx.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: artifact } = await (auth.supabase as any)
    .from("artifacts")
    .select("run_command, expose_port, snapshot_id")
    .eq("id", artifactId)
    .eq("org_id", auth.orgId)
    .single();

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get current version number to fetch the right files
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: artFull } = await (auth.supabase as any)
    .from("artifacts")
    .select("current_version")
    .eq("id", artifactId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (auth.supabase as any)
    .from("artifact_files")
    .select("file_path, content")
    .eq("artifact_id", artifactId)
    .order("file_path");

  if (artFull?.current_version) {
    query = query.eq("version_number", artFull.current_version);
  }

  const { data: fileRows } = await query;

  const files = (fileRows ?? []).map((f: { file_path: string; content: string }) => ({
    path: f.file_path,
    content: f.content,
  }));

  if (files.length === 0) {
    return NextResponse.json({ error: "No files found for artifact" }, { status: 400 });
  }

  try {
    const { executeProject } = await import("@/lib/sandbox/execute");
    const result = await executeProject({
      files,
      installCommand: "npm install",
      runCommand: artifact.run_command ?? "npm run dev",
      exposePort: artifact.expose_port ?? 5173,
      orgId: auth.orgId,
      userId: auth.user.id,
      snapshotId: artifact.snapshot_id ?? undefined,
    });

    if (result.previewUrl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (auth.supabase as any)
        .from("artifacts")
        .update({ preview_url: result.previewUrl })
        .eq("id", artifactId);
    }

    return NextResponse.json({
      previewUrl: result.previewUrl ?? null,
      sandboxId: result.sandboxId,
      status: "running",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start sandbox" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/sandbox/[artifactId] — Stop sandbox
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { artifactId } = await ctx.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: artifact } = await (auth.supabase as any)
    .from("artifacts")
    .select("snapshot_id")
    .eq("id", artifactId)
    .eq("org_id", auth.orgId)
    .single();

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sandboxName = artifact.snapshot_id ?? `layers-${auth.orgId.slice(0, 8)}`;
  try {
    const { Sandbox } = await import("@vercel/sandbox");
    const sb = await Sandbox.get({ name: sandboxName });
    await sb.stop();
  } catch {
    // Already stopped or doesn't exist
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (auth.supabase as any)
    .from("artifacts")
    .update({ preview_url: null })
    .eq("id", artifactId);

  return NextResponse.json({ status: "stopped" });
}
