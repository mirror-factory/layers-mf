export const metadata = { title: "Notifications" };

import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "@/components/notifications-list";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Show notifications from last 30 days (same table as notification bell)
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notifications } = await (supabase as any)
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at, metadata")
    .eq("user_id", user.id)
    .gte("created_at", cutoffDate)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6 sm:mb-8">
        <h1 data-testid="inbox-page-heading" className="text-xl sm:text-2xl font-semibold mb-1">
          Notifications
        </h1>
        <p className="text-muted-foreground text-sm">
          Recent notifications from your schedules, agents, and team activity.
        </p>
      </div>
      <NotificationsList initialNotifications={notifications ?? []} />
    </div>
  );
}
