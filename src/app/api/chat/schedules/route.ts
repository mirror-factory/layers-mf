import { NextRequest } from "next/server";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient } from "@/lib/supabase/server";
import { createTools } from "@/lib/ai/tools";

export const maxDuration = 60;

const SCHEDULE_SYSTEM_PROMPT = `You help users create and manage scheduled tasks. You can create new schedules, list existing ones, edit them, or delete them. Ask clarifying questions about timing, frequency, and what the task should do.

When the user asks to create a schedule:
1. Ask what the task should do if not specified
2. Ask about timing/frequency if not specified
3. Use schedule_action to create it

When the user asks to see schedules, use list_schedules.
When the user asks to edit a schedule, use edit_schedule.
When the user asks to delete a schedule, use delete_schedule.

Be concise and helpful. Focus only on schedule management.`;

const MODEL_ID = "google/gemini-3-flash";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return new Response("Invalid messages", { status: 400 });
  }

  const uiMessages: UIMessage[] = body.messages;

  if (uiMessages.length === 0) {
    return new Response("Invalid messages", { status: 400 });
  }

  const orgId = member.org_id;
  const allTools = createTools(supabase, orgId, user.id);

  // Only expose scheduling tools
  const scheduleTools = {
    schedule_action: allTools.schedule_action,
    list_schedules: allTools.list_schedules,
    edit_schedule: allTools.edit_schedule,
    delete_schedule: allTools.delete_schedule,
  };

  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: gateway(MODEL_ID),
    system: SCHEDULE_SYSTEM_PROMPT + `\n\nCurrent date/time: ${new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })}.`,
    messages: modelMessages,
    tools: scheduleTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
