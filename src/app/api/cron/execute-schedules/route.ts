import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { calculateNextCron } from "@/lib/cron";
import { ToolLoopAgent, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import {
  createScheduleToolsByTier,
  STEP_LIMITS,
  type ToolTier,
} from "@/lib/schedules/tools";

// TODO: When @workflow/ai DurableAgent is GA, replace ToolLoopAgent with DurableAgent
// for 'full' tier schedules to remove the 60s timeout limit.
// See docs/architecture-plan-v2.md section 1.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_SCHEDULE_MODEL = "google/gemini-3-flash";

const SYSTEM_PROMPT = `You are Dewey, the resident Librarian assistant inside Layers, running a scheduled background task.
You have access to a knowledge base via search_context. Use it when the user's prompt requires looking up information.
Be concise and actionable. Summarize findings clearly. If you searched and found nothing relevant, say so.
Do NOT use markdown headings. Use plain text with bullet points when listing items.`;

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
