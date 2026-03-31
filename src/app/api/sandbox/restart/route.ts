import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sandbox/restart
 * Restart a sandbox from a snapshot — instant restore with fresh preview URL.
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
    snapshotId: string;
    runCommand?: string;
    exposePort?: number;
    files?: { path: string; content: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.snapshotId) {
    return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });
  }

  try {
    const { executeProject } = await import("@/lib/sandbox/execute");

    const result = await executeProject({
      files: body.files ?? [],
      runCommand: body.runCommand ?? "npm start",
      exposePort: body.exposePort ?? 3000,
      snapshotId: body.snapshotId,
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
