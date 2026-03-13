import { createClient } from "@/lib/supabase/server";
import { ConnectPanel } from "@/components/integrations/connect-panel";

export default async function IntegrationsPage() {
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

  const { data: integrations } = member
    ? await supabase
        .from("integrations")
        .select("id, provider, nango_connection_id, status, last_sync_at, created_at")
        .eq("org_id", member.org_id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="p-4 sm:p-8 max-w-3xl" data-testid="integrations-page">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1" data-testid="integrations-heading">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Connect your tools so Layers can sync meetings, issues, and documents
          automatically.
        </p>
      </div>
      <ConnectPanel initialIntegrations={integrations ?? []} />
    </div>
  );
}
