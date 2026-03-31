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

  if (!body.snapshotId && (!body.files || body.files.length === 0)) {
    return NextResponse.json({ error: "Either snapshotId or files are required" }, { status: 400 });
  }

  try {
    const { executeProject } = await import("@/lib/sandbox/execute");

    // Determine if we need npm install (when no snapshot and files include package.json)
    const hasPackageJson = body.files?.some(f => f.path === "package.json" || f.path.endsWith("/package.json"));
    const installCommand = !body.snapshotId && hasPackageJson ? "npm install" : undefined;

    const result = await executeProject({
      files: body.files ?? [],
      installCommand,
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
