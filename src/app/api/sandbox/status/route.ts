import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/sandbox/status
 * Returns sandbox-capable artifacts for the user's org.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member?.org_id) {
    return NextResponse.json({ error: "No org found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: artifacts, error } = await (supabase as any)
    .from("artifacts")
    .select("id, title, preview_url, snapshot_id, run_command, expose_port, framework, updated_at")
    .eq("org_id", member.org_id)
    .not("preview_url", "is", null)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgPrefix = `layers-${member.org_id.slice(0, 8)}`;

  const items = (artifacts ?? []).map((a: Record<string, unknown>) => ({
    artifactId: a.id,
    title: a.title,
    previewUrl: a.preview_url,
    sandboxName: a.snapshot_id ?? orgPrefix,
    runCommand: a.run_command ?? "npm run dev",
    exposePort: a.expose_port ?? 5173,
    framework: a.framework ?? null,
    updatedAt: a.updated_at,
  }));

  return NextResponse.json({ artifacts: items });
}
