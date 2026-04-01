export const metadata = { title: "Schedules" };

import { createClient } from "@/lib/supabase/server";
import { ScheduleList } from "@/components/schedule-list";
import { PageExplainer } from "@/components/page-explainer";

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
        title="How Schedules Work"
        sections={[
          { title: "What are schedules", content: "Recurring or one-time tasks that Granger executes automatically. Examples: 'Check my Linear every morning', 'Send a weekly digest', 'Sync Drive files daily'." },
          { title: "Creating schedules", content: "Ask Granger in chat: 'every morning check my Linear issues'. Granger converts natural language to cron expressions and creates the schedule." },
          { title: "Managing schedules", content: "Pause, resume, edit, or delete schedules here. Each schedule shows its cron expression, last run time, and next scheduled execution." },
        ]}
      />
      <ScheduleList initialSchedules={schedules ?? []} />
    </div>
  );
}
