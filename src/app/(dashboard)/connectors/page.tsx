import { createClient } from "@/lib/supabase/server";
import { ConnectorsView } from "@/components/connectors-view";

interface Integration {
  id: string;
  provider: string;
  nango_connection_id: string;
  status: string;
  last_sync_at: string | null;
}

interface MCPServer {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  last_connected_at: string | null;
  error_message: string | null;
  discovered_tools: { name: string }[];
}

export const metadata = {
  title: "Connectors",
};

export default async function ConnectorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-8 text-muted-foreground">Please sign in.</div>;
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return <div className="p-8 text-muted-foreground">No organization found.</div>;
  }

  // Fetch integrations (Nango connections)
  let integrations: Integration[] = [];
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("integrations")
      .select("id, provider, nango_connection_id, status, last_sync_at")
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false });
    integrations = data ?? [];
  } catch {
    // Table may not exist yet
  }

  // Fetch MCP servers
  let mcpServers: MCPServer[] = [];
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("mcp_servers")
      .select("id, name, url, is_active, last_connected_at, error_message, discovered_tools")
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false });
    mcpServers = data ?? [];
  } catch {
    // Table may not exist yet
  }

  return (
    <ConnectorsView
      integrations={integrations}
      mcpServers={mcpServers}
    />
  );
}
