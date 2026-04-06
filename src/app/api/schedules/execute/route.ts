import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateText, tool, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { searchContext, searchContextChunks } from "@/lib/db/search";
import { calculateNextCron } from "@/lib/cron";

export const maxDuration = 120;

const SCHEDULE_MODEL = "google/gemini-3-flash";

const SYSTEM_PROMPT = `You are Granger, an AI assistant running a scheduled background task.
You have access to a knowledge base via search_context. Use it when the user's prompt requires looking up information.
Be concise and actionable. Summarize findings clearly.`;

function createScheduleTools(supabase: ReturnType<typeof createAdminClient>, orgId: string) {
  return {
    search_context: tool({
      description: "Search the organization's knowledge base.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        limit: z.number().min(1).max(20).optional().describe("Maximum results"),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        const chunkResults = await searchContextChunks(
          supabase as Parameters<typeof searchContextChunks>[0],
          orgId,
          query,
          limit ?? 8,
          undefined,
          true,
        );
        if (chunkResults.length > 0) {
          return {
            results: chunkResults.map((r) => ({
              title: r.title,
              snippet: r.parent_content?.slice(0, 500) ?? r.description_short ?? "",
              source_type: r.source_type,
              content_type: r.content_type,
            })),
          };
        }
        const results = await searchContext(
          supabase as Parameters<typeof searchContext>[0],
          orgId,
          query,
          limit ?? 8,
        );
        return {
          results: results.map((r) => ({
            title: r.title,
            snippet: r.description_short ?? r.description_long?.slice(0, 500) ?? "",
            source_type: r.source_type,
            content_type: r.content_type,
          })),
        };
      },
    }),
  };
}

/**
 * POST /api/schedules/execute
 * Execute a schedule on-demand (from "Run Now" button).
 * Creates a conversation, runs AI, saves results, notifies user.
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

  let body: { scheduleId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { scheduleId } = body;
  if (!scheduleId) {
    return NextResponse.json(
      { error: "Missing required field: scheduleId" },
      { status: 400 },
    );
  }

  try {
    const adminSupabase = createAdminClient();

    // Fetch the schedule
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: schedule, error: scheduleError } = await (adminSupabase as any)
      .from("scheduled_actions")
      .select("*")
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const orgId = member.org_id;

    // Build prompt
    const prompt =
      schedule.payload?.prompt ??
      schedule.description ??
      `Execute scheduled action: ${schedule.name}`;

    // Create conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conv } = await (adminSupabase as any)
      .from("conversations")
      .insert({
        org_id: orgId,
        user_id: user.id,
        title: `Scheduled: ${schedule.name}`,
        initiated_by: "schedule",
        schedule_id: scheduleId,
      })
      .select("id")
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 },
      );
    }

    const conversationId = conv.id as string;

    // Save user message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any).from("chat_messages").insert({
      org_id: orgId,
      user_id: user.id,
      conversation_id: conversationId,
      role: "user",
      content: [{ type: "text", text: prompt }],
      channel: "schedule",
    });

    // Run AI
    const tools = createScheduleTools(adminSupabase, orgId);

    const { text } = await generateText({
      model: gateway(SCHEDULE_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      tools,
      stopWhen: stepCountIs(5),
    });

    const responseText = text || "Schedule executed but produced no output.";

    // Save AI response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any).from("chat_messages").insert({
      org_id: orgId,
      user_id: user.id,
      conversation_id: conversationId,
      role: "assistant",
      content: [{ type: "text", text: responseText }],
      channel: "schedule",
    });

    // Update schedule metadata
    const newRunCount = (schedule.run_count ?? 0) + 1;
    const isCompleted = schedule.max_runs && newRunCount >= schedule.max_runs;
    const isOneShot = typeof schedule.schedule === "string" && schedule.schedule.startsWith("once:");
    const nextRun = isOneShot ? null : calculateNextCron(schedule.schedule);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from("scheduled_actions")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: newRunCount,
        next_run_at: nextRun,
        status: isCompleted || isOneShot ? "completed" : schedule.status,
        error_message: null,
        last_conversation_id: conversationId,
      })
      .eq("id", scheduleId);

    // Create notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any).from("notifications").insert({
      org_id: orgId,
      user_id: user.id,
      type: "schedule_complete",
      title: `Scheduled: ${schedule.name}`,
      body: responseText.slice(0, 200),
      link: `/chat?id=${conversationId}`,
      metadata: { schedule_id: scheduleId, conversation_id: conversationId },
    });

    return NextResponse.json({ conversationId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execution failed" },
      { status: 500 },
    );
  }
}
