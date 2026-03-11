import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SessionWorkspace } from "@/components/session-workspace";

type ContextItem = {
  id: string;
  title: string;
  source_type: string;
  content_type: string;
  description_short: string | null;
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user!.id)
    .single();

  if (!member) notFound();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, name, goal, status, created_at, updated_at, last_agent_run")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!session) notFound();

  // Get linked context items
  const { data: links } = await supabase
    .from("session_context_links")
    .select("context_item_id")
    .eq("session_id", id);

  const linkedIds = (links ?? []).map(
    (l: { context_item_id: string }) => l.context_item_id
  );

  let linkedItems: ContextItem[] = [];
  if (linkedIds.length > 0) {
    const { data } = await supabase
      .from("context_items")
      .select("id, title, source_type, content_type, description_short")
      .in("id", linkedIds);
    linkedItems = (data ?? []) as ContextItem[];
  }

  // Get all org context items for the picker (excluding already linked)
  const { data: allItems } = await supabase
    .from("context_items")
    .select("id, title, source_type, content_type, description_short")
    .eq("org_id", member.org_id)
    .order("ingested_at", { ascending: false })
    .limit(200);

  const availableItems = (allItems ?? []).filter(
    (item) => !linkedIds.includes((item as ContextItem).id)
  ) as ContextItem[];

  return (
    <SessionWorkspace
      session={session as { id: string; name: string; goal: string; status: string; updated_at: string }}
      linkedItems={linkedItems}
      availableItems={availableItems}
    />
  );
}
