export const metadata = { title: "Schedules" };

import { createClient } from "@/lib/supabase/server";
import { ScheduleList } from "@/components/schedule-list";
import { PageExplainer } from "@/components/page-explainer";
import { ScheduleChat } from "@/components/schedule-chat";

export default async function SchedulesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schedules } = member
    ? await (supabase as any)
        .from("scheduled_actions")
        .select("*")
        .eq("org_id", member.org_id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: null };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Schedules</h1>
        <p className="text-muted-foreground text-sm">
          Recurring and one-time tasks managed by Granger.
        </p>
      </div>
      <PageExplainer
        title="How Scheduling Works"
        sections={[
          {
            title: "What schedules do",
            content:
              "Schedules run your prompts automatically on a recurring basis. The AI creates a new conversation each time, searches your knowledge base, and sends you a notification when done.",
          },
          {
            title: "Viewing results",
            content:
              "You can view the results by clicking the notification or finding the conversation in your chat history. Each schedule tracks its last run and links to the conversation.",
          },
          {
            title: "Timing options",
            content:
              "Choose from presets like \"Every hour\", \"Daily at 9am\", \"Weekdays at 9am\", \"Every 6 hours\", \"Weekly Monday 9am\", or \"Every 30 minutes\". You can also enter a custom cron expression for advanced scheduling.",
          },
          {
            title: "Managing schedules",
            content:
              "Pause, resume, edit, or delete schedules anytime. You can also ask Granger in chat to create schedules using natural language, e.g. \"every morning check my Linear issues\".",
          },
        ]}
      />
      <div className="mb-6">
        <ScheduleChat />
      </div>
      <ScheduleList initialSchedules={schedules ?? []} />
    </div>
  );
}
