export const metadata = { title: "Inbox" };

import { createClient } from "@/lib/supabase/server";
import { InboxList } from "@/components/inbox-list";
import { PageExplainer } from "@/components/page-explainer";

export default async function InboxPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: items } = await supabase
    .from("inbox_items")
    .select("id, type, title, body, priority, status, source_url, source_type, created_at")
    .eq("user_id", user.id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6 sm:mb-8">
        <h1 data-testid="inbox-page-heading" className="text-xl sm:text-2xl font-semibold mb-1">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          Action items, decisions, and mentions surfaced by your agents.
        </p>
      </div>
      <PageExplainer
        title="How Inbox Works"
        sections={[
          { title: "What appears here", content: "Action items, decisions, and @mentions surfaced by Granger from your meetings, messages, and tasks. Items are prioritized by urgency." },
          { title: "Sources", content: "Inbox items come from scheduled digests, integration syncs, and agent analysis of your connected services (Linear, Gmail, Granola, Slack)." },
          { title: "Actions", content: "Mark items as done, snooze them, or dismiss. Items you act on help Granger learn what matters to you." },
        ]}
      />
      <InboxList initialItems={items ?? []} />
    </div>
  );
}
