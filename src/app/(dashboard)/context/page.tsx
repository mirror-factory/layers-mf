export const metadata = { title: "Context Library" };
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { ContextLibraryTabs } from "@/components/context-library-tabs";

export default async function ContextPage(props: {
  searchParams?: Promise<{
    search?: string;
    source?: string;
    folder?: string;
    type?: string;
    tags?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminDb = createAdminClient();

  const { data: member } = await adminDb
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  const { data: items } = member
    ? await adminDb
        .from("context_items")
        .select(
          "id, title, description_short, source_type, content_type, status, ingested_at",
        )
        .eq("org_id", member.org_id)
        .order("ingested_at", { ascending: false })
        .limit(500)
    : { data: [] };

  return (
    <ContextLibraryTabs
      items={items ?? []}
      initialSearch={searchParams?.search ?? ""}
      initialSource={searchParams?.source ?? ""}
      initialFolder={searchParams?.folder ?? ""}
      initialType={searchParams?.type ?? ""}
      initialTags={searchParams?.tags ?? ""}
      initialStatus={searchParams?.status ?? ""}
      initialFrom={searchParams?.from ?? ""}
      initialTo={searchParams?.to ?? ""}
    />
  );
}
