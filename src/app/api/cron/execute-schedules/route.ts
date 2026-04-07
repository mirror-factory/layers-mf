import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculateNextCron } from "@/lib/cron";
import { generateText, tool, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { searchContext, searchContextChunks } from "@/lib/db/search";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SCHEDULE_MODEL = "google/gemini-3-flash";

const SYSTEM_PROMPT = `You are Granger, an AI assistant running a scheduled background task.
You have access to a knowledge base via search_context. Use it when the user's prompt requires looking up information.
Be concise and actionable. Summarize findings clearly. If you searched and found nothing relevant, say so.
Do NOT use markdown headings. Use plain text with bullet points when listing items.`;

/**
 * Build a minimal tool set for scheduled runs.
 * Only search_context (no sandbox, no integrations -- too expensive for background).
 */
function createScheduleTools(supabase: ReturnType<typeof createAdminClient>, orgId: string) {
  return {
    search_context: tool({
      description: "Search the organization's knowledge base for documents, meetings, notes, and other context.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        limit: z.number().min(1).max(20).optional().describe("Maximum results (default 8)"),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        // Try chunk-based search first for richer context
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

        // Fall back to item-level search
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
 * GET /api/cron/execute-schedules
 * Runs every minute via Vercel cron. Finds due schedules, runs AI with the
 * scheduled prompt, saves results as chat conversations, and notifies users.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const demoMode = process.env.DEMO_MODE === "true";
  if (!demoMode && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find schedules that are due
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
      { status: 500 },
    );
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    return NextResponse.json({ executed: 0, results: [] });
  }

  const results: { id: string; status: string; conversationId?: string }[] = [];

  for (const schedule of dueSchedules) {
    try {
      const orgId = schedule.org_id as string;
      const userId = schedule.created_by as string;

      // Build the prompt from description or payload.prompt
      const prompt =
        schedule.payload?.prompt ??
        schedule.description ??
        `Execute scheduled action: ${schedule.name}`;

      // 1. Create a conversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: conv } = await (supabase as any)
        .from("conversations")
        .insert({
          org_id: orgId,
          user_id: userId,
          title: `Scheduled: ${schedule.name}`,
          initiated_by: "schedule",
          schedule_id: schedule.id,
        })
        .select("id")
        .single();

      if (!conv) {
        results.push({ id: schedule.id, status: "failed_no_conversation" });
        continue;
      }

      const conversationId = conv.id as string;

      // 2. Save the user message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("chat_messages").insert({
        org_id: orgId,
        user_id: userId,
        conversation_id: conversationId,
        role: "user",
        content: [{ type: "text", text: prompt }],
        channel: "schedule",
      });

      // 3. Run AI with generateText
      const tools = createScheduleTools(supabase, orgId);

      const { text } = await generateText({
        model: gateway(SCHEDULE_MODEL),
        system: SYSTEM_PROMPT,
        prompt,
        tools,
        stopWhen: stepCountIs(5),
      });

      const responseText = text || "Schedule executed but produced no output.";

      // 4. Save the AI response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("chat_messages").insert({
        org_id: orgId,
        user_id: userId,
        conversation_id: conversationId,
        role: "assistant",
        content: [{ type: "text", text: responseText }],
        channel: "schedule",
      });

      // 5. Update schedule metadata
      const newRunCount = (schedule.run_count ?? 0) + 1;
      const isCompleted = schedule.max_runs && newRunCount >= schedule.max_runs;
      const isOneShot = typeof schedule.schedule === "string" && schedule.schedule.startsWith("once:");

      const nextRun = isOneShot ? null : calculateNextCron(schedule.schedule);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from("scheduled_actions")
        .update({
          last_run_at: new Date().toISOString(),
          run_count: newRunCount,
          next_run_at: nextRun,
          status: isCompleted || isOneShot ? "completed" : "active",
          error_message: null,
          last_conversation_id: conversationId,
        })
        .eq("id", schedule.id);

      if (updateErr) {
        console.error(`[schedule] Failed to update schedule ${schedule.id}:`, updateErr.message);
      }

      // 6. Create a notification for the user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("notifications").insert({
        org_id: orgId,
        user_id: userId,
        type: "schedule_complete",
        title: `Scheduled: ${schedule.name}`,
        body: responseText.slice(0, 200),
        link: `/chat?id=${conversationId}`,
        metadata: { schedule_id: schedule.id, conversation_id: conversationId },
      });

      results.push({ id: schedule.id, status: "executed", conversationId });
    } catch (err) {
      // Mark schedule with error but don't stop processing others
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
