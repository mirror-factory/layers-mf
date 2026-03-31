import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculateNextCron } from "@/lib/cron";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/execute-schedules
 * Master cron that runs every minute. Checks scheduled_actions for items due
 * and executes them (either via their payload endpoint or by logging the run).
 */
export async function GET(request: NextRequest) {
  // Auth via CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const demoMode = process.env.DEMO_MODE === "true";
  if (!demoMode && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find schedules that are due (next_run_at <= now AND status = 'active')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dueSchedules, error: queryError } = await (supabase as any)
    .from("scheduled_actions")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .limit(10);

  if (queryError) {
    return NextResponse.json(
      { error: "Failed to query schedules", detail: queryError.message },
      { status: 500 }
    );
  }

  const results: { id: string; status: string }[] = [];

  for (const schedule of dueSchedules ?? []) {
    try {
      // Execute based on payload.endpoint or description
      if (schedule.payload?.endpoint) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        await fetch(`${baseUrl}${schedule.payload.endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
        });
      }

      // Calculate next run time
      const nextRun = schedule.schedule.startsWith("once:")
        ? null // one-shot, no next run
        : calculateNextCron(schedule.schedule);

      const newRunCount = (schedule.run_count ?? 0) + 1;
      const isCompleted = schedule.max_runs && newRunCount >= schedule.max_runs;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("scheduled_actions")
        .update({
          last_run_at: new Date().toISOString(),
          run_count: newRunCount,
          next_run_at: nextRun,
          status: isCompleted || schedule.schedule.startsWith("once:") ? "completed" : "active",
          error_message: null,
        })
        .eq("id", schedule.id);

      results.push({ id: schedule.id, status: "executed" });
    } catch (err) {
      // Mark as failed with error message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("scheduled_actions")
        .update({
          error_message: err instanceof Error ? err.message : "Execution failed",
        })
        .eq("id", schedule.id);

      results.push({ id: schedule.id, status: "failed" });
    }
  }

  return NextResponse.json({
    executed: results.length,
    results,
  });
}
