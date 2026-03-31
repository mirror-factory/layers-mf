import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { executeScheduleAndCreateChat } from "@/lib/schedule-executor";

/**
 * POST /api/schedules/execute
 * Execute a scheduled action immediately and create a chat conversation with results.
 * Supports both endpoint-based schedules and custom schedules (processed via chat AI).
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

  if (!scheduleId) {
    return NextResponse.json(
      { error: "Missing required field: scheduleId" },
      { status: 400 }
    );
  }

  // If an explicit endpoint was provided, use the direct executor
  if (endpoint) {
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

  // Custom schedule — look up the schedule and process via chat AI
  try {
    const adminSupabase = createAdminClient();

    // Fetch the schedule details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: schedule, error: scheduleError } = await (adminSupabase as any)
      .from("scheduled_actions")
      .select("*")
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Check if there's a known endpoint in the payload
    if (schedule.payload?.endpoint) {
      const result = await executeScheduleAndCreateChat(
        scheduleId,
        member.org_id,
        user.id,
        schedule.payload.endpoint
      );

      return NextResponse.json({
        conversationId: result.conversationId,
        result: result.result,
      });
    }

    // No endpoint — create a conversation and send the description to the chat API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conv } = await (adminSupabase as any)
      .from("conversations")
      .insert({
        org_id: member.org_id,
        user_id: user.id,
        title: `Schedule: ${schedule.name}`,
        initiated_by: "schedule",
        schedule_id: scheduleId,
      })
      .select("id")
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    // Build the prompt from the schedule's description/payload
    const prompt = schedule.description
      ?? schedule.payload?.prompt
      ?? `Execute scheduled action: ${schedule.name}`;

    // Send the prompt to the chat API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        messages: [{ role: "user", parts: [{ type: "text", text: prompt }] }],
        conversationId: conv.id,
        model: "google/gemini-2.5-flash-lite",
      }),
    });

    // Read the streamed response to completion (we don't need to parse it)
    if (chatRes.body) {
      const reader = chatRes.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    // Update schedule run metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from("scheduled_actions")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (schedule.run_count ?? 0) + 1,
      })
      .eq("id", scheduleId);

    return NextResponse.json({
      conversationId: conv.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execution failed" },
      { status: 500 }
    );
  }
}
