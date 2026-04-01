export const metadata = { title: "Integrations" };

import { createClient } from "@/lib/supabase/server";
import { ConnectPanel } from "@/components/integrations/connect-panel";
import { IntegrationCatalog } from "@/components/integrations/integration-catalog";
import { PageExplainer } from "@/components/page-explainer";

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

  const connectedProviders = new Set(
    (integrations ?? []).map((i) => i.provider)
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl" data-testid="integrations-page">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1" data-testid="integrations-heading">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Connect your tools so Granger can sync meetings, issues, and documents
          automatically.
        </p>
      </div>
      <PageExplainer
        title="How Integrations Work"
        sections={[
          { title: "Nango OAuth", content: "Integrations use Nango for secure OAuth connections. Click 'Connect' to authorize Granger to access your Google Drive, GitHub, Slack, Linear, or other services." },
          { title: "Automatic sync", content: "Once connected, Granger syncs documents, issues, messages, and files into the Context Library automatically. Webhooks trigger real-time updates." },
          { title: "MCP servers", content: "For deeper integrations, connect MCP (Model Context Protocol) servers in the MCP Servers page. MCP gives Granger direct tool access to external services." },
        ]}
      />
      <ConnectPanel initialIntegrations={integrations ?? []} />

      <div className="mt-12">
        <IntegrationCatalog connectedProviders={connectedProviders} />
      </div>
    </div>
  );
}
