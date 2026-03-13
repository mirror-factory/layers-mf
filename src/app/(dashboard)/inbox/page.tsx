import { createClient } from "@/lib/supabase/server";
import { InboxList } from "@/components/inbox-list";

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
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 data-testid="inbox-page-heading" className="text-2xl font-semibold mb-1">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          Action items, decisions, and mentions surfaced by your agents.
        </p>
      </div>
      <InboxList initialItems={items ?? []} />
    </div>
  );
}
