import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculateNextCron } from "@/lib/cron";
import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { searchContext, searchContextChunks } from "@/lib/db/search";
import { createTools } from "@/lib/ai/tools";

// TODO: When @workflow/ai DurableAgent is GA, replace ToolLoopAgent with DurableAgent
// for 'full' tier schedules to remove the 60s timeout limit.
// See docs/architecture-plan-v2.md section 1.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_SCHEDULE_MODEL = "google/gemini-3-flash";

export type ToolTier = "minimal" | "standard" | "full";

const SYSTEM_PROMPT = `You are Granger, an AI assistant running a scheduled background task.
You have access to a knowledge base via search_context. Use it when the user's prompt requires looking up information.
Be concise and actionable. Summarize findings clearly. If you searched and found nothing relevant, say so.
Do NOT use markdown headings. Use plain text with bullet points when listing items.`;

/**
 * Build a minimal tool set for scheduled runs.
 * Only search_context (no sandbox, no integrations -- too expensive for background).
 */
export function createScheduleTools(supabase: ReturnType<typeof createAdminClient>, orgId: string) {
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

/** Step limits per tier */
const STEP_LIMITS: Record<ToolTier, number> = {
  minimal: 5,
  standard: 10,
  full: 20,
};

/**
 * Build tool sets based on tier.
 *
 * - minimal: search_context only (current behavior, cheapest)
 * - standard: search + artifact + web tools (mid-range)
 * - full: all 25+ tools from createTools (sandbox, MCP, etc.)
 */
export function createScheduleToolsByTier(
  tier: ToolTier,
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
) {
  // Minimal: just search (current behavior)
  if (tier === "minimal") {
    return createScheduleTools(supabase, orgId);
  }

  // Full: everything from the main tool factory
  if (tier === "full") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createTools(supabase as any, orgId, userId);
  }

  // Standard: search + artifacts + web (mid-range)
  const baseTools = createScheduleTools(supabase, orgId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullTools = createTools(supabase as any, orgId, userId);

  // Cherry-pick standard-tier tools: artifact management + web access + code tools
  const standardToolNames = [
    "artifact_list",
    "artifact_get",
    "write_code",
    "edit_code",
    "web_browse",
    "web_search",
  ] as const;

  const standardExtras: Record<string, unknown> = {};
  for (const name of standardToolNames) {
    if (name in fullTools) {
      standardExtras[name] = fullTools[name as keyof typeof fullTools];
    }
  }

  return { ...baseTools, ...standardExtras };
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
      const basePrompt =
        schedule.payload?.prompt ??
        schedule.description ??
        `Execute scheduled action: ${schedule.name}`;

      // If email template instructions exist, append them so the AI formats output for email
      const emailTemplate = schedule.payload?.email_template as string | undefined;
      const prompt = emailTemplate
        ? `${basePrompt}\n\nIMPORTANT — Format your response for email delivery using these instructions: ${emailTemplate}`
        : basePrompt;

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

      // 2. Notify user that execution has started
      try {
        const { notify } = await import("@/lib/notifications/notify");
        await notify({
          userId,
          orgId,
          type: "schedule_started",
          title: `Executing: ${schedule.name}`,
          body: `Running scheduled task...`,
          link: `/chat?id=${conversationId}`,
          metadata: { schedule_id: schedule.id, conversation_id: conversationId },
        });
      } catch (notifyErr) {
        console.error("[schedule] Start notification failed:", notifyErr);
      }

      // 3. Save the user message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("chat_messages").insert({
        org_id: orgId,
        user_id: userId,
        conversation_id: conversationId,
        role: "user",
        content: [{ type: "text", text: prompt }],
        channel: "schedule",
      });

      // 4. Run AI with ToolLoopAgent (supports multi-step tool use)
      const tier: ToolTier = (schedule.tool_tier as ToolTier) || "minimal";
      const tools = createScheduleToolsByTier(tier, supabase, orgId, userId);
      const scheduleModel = (schedule.payload?.model as string) ?? DEFAULT_SCHEDULE_MODEL;

      const agent = new ToolLoopAgent({
        model: gateway(scheduleModel),
        instructions: SYSTEM_PROMPT,
        tools,
        stopWhen: stepCountIs(STEP_LIMITS[tier]),
      });
      const result = await agent.generate({ prompt });
      const text = result.text;

      const responseText = text || "Schedule executed but produced no output.";

      // 5. Save the AI response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("chat_messages").insert({
        org_id: orgId,
        user_id: userId,
        conversation_id: conversationId,
        role: "assistant",
        content: [{ type: "text", text: responseText }],
        channel: "schedule",
      });

      // 5b. Send email to configured recipients
      const emailRecipients = (schedule.payload?.email_recipients ?? []) as string[];
      if (emailRecipients.length > 0) {
        try {
          const { sendEmail } = await import("@/lib/notifications/send-email");
          const emailSubject = `Scheduled: ${schedule.name}`;
          const emailPromises = emailRecipients.map((to) =>
            sendEmail({
              to,
              subject: emailSubject,
              text: responseText,
            })
          );
          await Promise.allSettled(emailPromises);
        } catch (emailErr) {
          console.error("[schedule] Email send failed:", emailErr);
        }
      }

      // 6. Update schedule metadata
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

      // 7. Notify user of completion (in-app + push + email based on preferences)
      try {
        const { notify } = await import("@/lib/notifications/notify");
        await notify({
          userId,
          orgId,
          type: "schedule_complete",
          title: `Scheduled: ${schedule.name}`,
          body: responseText.slice(0, 200),
          link: `/chat?id=${conversationId}`,
          metadata: { schedule_id: schedule.id, conversation_id: conversationId },
        });
      } catch (notifyErr) {
        console.error("[schedule] Notification failed:", notifyErr);
      }

      results.push({ id: schedule.id, status: "executed", conversationId });
    } catch (err) {
      // Mark schedule with error but don't stop processing others
      const errorMsg = err instanceof Error ? err.message : "Execution failed";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("scheduled_actions")
        .update({ error_message: errorMsg })
        .eq("id", schedule.id);

      // Notify user about the schedule failure
      try {
        const { notify } = await import("@/lib/notifications/notify");
        await notify({
          userId: schedule.created_by as string,
          orgId: schedule.org_id as string,
          type: "system_alert",
          title: `Schedule failed: ${schedule.name}`,
          body: `Error: ${errorMsg.slice(0, 200)}`,
          link: "/schedules",
          metadata: { schedule_id: schedule.id, error: errorMsg },
        });
      } catch {
        /* silent */
      }

      results.push({ id: schedule.id, status: "failed" });
    }
  }

  return NextResponse.json({
    executed: results.length,
    results,
  });
}
