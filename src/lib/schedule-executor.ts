import { createAdminClient } from "@/lib/supabase/server";

/**
 * Execute a scheduled action and create a chat conversation with the results.
 * Used by the "Run Now" button and cron runner to produce visible output.
 */
export async function executeScheduleAndCreateChat(
  scheduleId: string,
  orgId: string,
  userId: string,
  endpoint: string
): Promise<{ conversationId: string | null; result: Record<string, unknown> }> {
  const supabase = createAdminClient();

  // 1. Execute the scheduled action
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });
  const data = await response.json();

  // 2. Create a conversation linked to this schedule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (supabase as any)
    .from("conversations")
    .insert({
      org_id: orgId,
      user_id: userId,
      title: `Schedule: ${data.title ?? endpoint.split("/").pop() ?? "task"}`,
      initiated_by: "schedule",
      schedule_id: scheduleId,
    })
    .select("id")
    .single();

  // 3. Store the result as a chat message
  if (conv) {
    const summary = data.summary ?? data;
    const formattedContent =
      typeof summary === "string" ? summary : JSON.stringify(summary, null, 2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("chat_messages").insert({
      org_id: orgId,
      user_id: userId,
      conversation_id: conv.id,
      role: "assistant",
      content: [{ type: "text", text: formattedContent }],
      channel: "system",
    });
  }

  // 4. Update schedule's last_run_at and increment run_count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("scheduled_actions")
    .update({
      last_run_at: new Date().toISOString(),
      run_count: data.run_count !== undefined ? data.run_count + 1 : undefined,
    })
    .eq("id", scheduleId);

  return { conversationId: conv?.id ?? null, result: data };
}
