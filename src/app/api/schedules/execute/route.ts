import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeScheduleAndCreateChat } from "@/lib/schedule-executor";

/**
 * POST /api/schedules/execute
 * Execute a scheduled action immediately and create a chat conversation with results.
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

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  let body: { scheduleId?: string; endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { scheduleId, endpoint } = body;

  if (!scheduleId || !endpoint) {
    return NextResponse.json(
      { error: "Missing required fields: scheduleId, endpoint" },
      { status: 400 }
    );
  }

  // Validate the endpoint is an internal API path
  if (!endpoint.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Endpoint must be an internal API path" },
      { status: 400 }
    );
  }

  try {
    const result = await executeScheduleAndCreateChat(
      scheduleId,
      member.org_id,
      user.id,
      endpoint
    );

    return NextResponse.json({
      conversationId: result.conversationId,
      result: result.result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execution failed" },
      { status: 500 }
    );
  }
}
