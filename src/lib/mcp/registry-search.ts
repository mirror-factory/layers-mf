/**
 * MCP Registry Search — shared logic for searching curated, official, and Smithery registries.
 * Used by both the /api/mcp/registry route and the search_mcp_servers AI tool.
 */

export interface MCPRegistryServer {
  name: string;
  description: string;
  url: string;
  type: string;
  website: string;
  auth: "oauth" | "bearer" | "none";
}

const CURATED_SERVERS: MCPRegistryServer[] = [
  { name: "GitHub", description: "Official GitHub MCP -- repos, PRs, issues, commits, Actions. Get a token at github.com/settings/tokens", url: "https://api.githubcopilot.com/mcp/", type: "streamable-http", website: "https://github.com/settings/tokens?type=beta", auth: "bearer" },
  { name: "Granola", description: "Meeting transcripts, notes, recordings", url: "https://mcp.granola.ai/mcp", type: "streamable-http", website: "https://granola.ai", auth: "oauth" },
  { name: "Sentry", description: "Error tracking, performance monitoring, release health", url: "https://mcp.sentry.dev/mcp", type: "streamable-http", website: "https://sentry.io", auth: "oauth" },
  { name: "Cloudflare", description: "Workers, KV, R2, DNS, analytics", url: "https://mcp.cloudflare.com/mcp", type: "streamable-http", website: "https://cloudflare.com", auth: "oauth" },
  { name: "Stripe", description: "Payments, subscriptions, invoices, customers", url: "https://mcp.stripe.com/mcp", type: "streamable-http", website: "https://stripe.com", auth: "oauth" },
  { name: "Resend", description: "Send emails, manage domains, API keys", url: "https://mcp.resend.com/mcp", type: "streamable-http", website: "https://resend.com", auth: "bearer" },
  { name: "Supabase", description: "Database, auth, storage, edge functions", url: "https://mcp.supabase.com/mcp", type: "streamable-http", website: "https://supabase.com", auth: "bearer" },
  { name: "Neon", description: "Serverless Postgres -- branches, queries, schemas", url: "https://mcp.neon.tech/mcp", type: "streamable-http", website: "https://neon.tech", auth: "oauth" },
  { name: "Browserbase", description: "Cloud browser automation, screenshots, scraping", url: "https://mcp.browserbase.com/mcp", type: "streamable-http", website: "https://browserbase.com", auth: "bearer" },
  { name: "Firecrawl", description: "Web scraping, crawling, content extraction", url: "https://mcp.firecrawl.dev/mcp", type: "streamable-http", website: "https://firecrawl.dev", auth: "bearer" },
  { name: "Canva", description: "Design platform -- create, edit, export designs, manage folders", url: "https://mcp.canva.com/mcp", type: "streamable-http", website: "https://canva.com", auth: "oauth" },
  { name: "Linear", description: "Issue tracking, project management, roadmaps", url: "https://mcp.linear.app/mcp", type: "streamable-http", website: "https://linear.app", auth: "oauth" },
  { name: "Notion", description: "Docs, databases, wikis, project management", url: "https://mcp.notion.so/mcp", type: "streamable-http", website: "https://notion.so", auth: "oauth" },
  { name: "Slack", description: "Messaging, channels, threads, search", url: "https://mcp.slack.com/mcp", type: "streamable-http", website: "https://slack.com", auth: "oauth" },
  { name: "Vercel", description: "Deployments, projects, domains, serverless functions", url: "https://mcp.vercel.com/mcp", type: "streamable-http", website: "https://vercel.com", auth: "oauth" },
];

function matchesQuery(server: MCPRegistryServer, query: string): boolean {
  if (!query) return true;
  const lq = query.toLowerCase();
  return (
    server.name.toLowerCase().includes(lq) ||
    server.description.toLowerCase().includes(lq)
  );
}

async function fetchSmithery(query: string): Promise<MCPRegistryServer[]> {
  try {
    const params = new URLSearchParams({ pageSize: "20", page: "1" });
    if (query) params.set("q", query);

    const res = await fetch(`https://registry.smithery.ai/servers?${params}`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const entries: Array<{
      displayName: string;
      description?: string;
      qualifiedName: string;
      homepage?: string;
      remote?: boolean;
    }> = data.servers ?? [];

    return entries
      .filter((e) => e.remote)
      .map((e) => ({
        name: e.displayName || e.qualifiedName,
        description: e.description ?? "",
        url: `https://server.smithery.ai/${e.qualifiedName}/mcp`,
        type: "streamable-http",
        website: e.homepage || `https://smithery.ai/servers/${e.qualifiedName}`,
        auth: "none" as const,
      }));
  } catch {
    return [];
  }
}

async function fetchOfficialRegistry(): Promise<MCPRegistryServer[]> {
  try {
    const res = await fetch("https://registry.modelcontextprotocol.io/v0/servers", {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const entries: {
      server: {
        name: string;
        description?: string;
        remotes?: { url: string; type: string }[];
        websiteUrl?: string;
      };
    }[] = data.servers ?? [];

    const results: MCPRegistryServer[] = [];
    for (const entry of entries) {
      const remote = entry.server.remotes?.[0];
      if (!remote?.url) continue;
      results.push({
        name: entry.server.name,
        description: entry.server.description ?? "",
        url: remote.url,
        type: remote.type ?? "streamable-http",
        website: entry.server.websiteUrl ?? "",
        auth: "oauth",
      });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Search all MCP registries and return deduplicated, merged results.
 */
export async function searchMCPRegistries(query: string): Promise<MCPRegistryServer[]> {
  const [officialServers, smitheryServers] = await Promise.all([
    fetchOfficialRegistry(),
    fetchSmithery(query),
  ]);

  const seen = new Map<string, MCPRegistryServer>();

  // Curated first (highest priority, most accurate auth info)
  for (const s of CURATED_SERVERS) {
    if (matchesQuery(s, query)) {
      seen.set(s.url, s);
    }
  }

  // Official registry
  for (const s of officialServers) {
    if (!seen.has(s.url) && matchesQuery(s, query)) {
      seen.set(s.url, s);
    }
  }

  // Smithery
  for (const s of smitheryServers) {
    if (!seen.has(s.url)) {
      seen.set(s.url, s);
    }
  }

  return Array.from(seen.values());
}
