import { createClient } from "@/lib/supabase/server";
import { IntegrationsConnect } from "@/components/integrations-connect";

export default async function IntegrationsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  const { data: integrations } = member
    ? await supabase
        .from("integrations")
        .select("id, provider, status, last_sync_at")
        .eq("org_id", member.org_id)
    : { data: [] };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Connect your tools so Layers can sync meetings, issues, and documents automatically.
        </p>
      </div>
      <IntegrationsConnect integrations={integrations ?? []} />
    </div>
  );
}
