import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sandbox/restart
 * Restart a sandbox from a snapshot or files — returns fresh preview URL.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    snapshotId?: string;
    runCommand?: string;
    exposePort?: number;
    files?: { path: string; content: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.files || body.files.length === 0) {
    return NextResponse.json({ error: "Files are required" }, { status: 400 });
  }

  // Get org for persistent sandbox
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  try {
    const { executeProject } = await import("@/lib/sandbox/execute");

    const result = await executeProject({
      files: body.files,
      installCommand: "npm install",
      runCommand: body.runCommand ?? "npm run dev",
      exposePort: body.exposePort ?? 5173,
      orgId: member?.org_id,
      userId: user.id,
    });

    return NextResponse.json({
      previewUrl: result.previewUrl ?? null,
      sandboxId: result.sandboxId,
      exitCode: result.exitCode,
      stdout: result.stdout?.slice(0, 2000),
      stderr: result.stderr?.slice(0, 500),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed to restart sandbox",
    }, { status: 500 });
  }
}
