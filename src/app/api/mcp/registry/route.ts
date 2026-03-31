import { NextRequest, NextResponse } from "next/server";

/* ─── Curated servers not yet in the official registry ─── */

interface RegistryServer {
  name: string;
  description: string;
  url: string;
  type: string;
  website: string;
  auth: "oauth" | "bearer" | "none";
}

const CURATED_SERVERS: RegistryServer[] = [
  { name: "GitHub", description: "Official GitHub MCP — repos, PRs, issues, commits, Actions. Get a token at github.com/settings/tokens", url: "https://api.githubcopilot.com/mcp/", type: "streamable-http", website: "https://github.com/settings/tokens?type=beta", auth: "bearer" },
  { name: "Granola", description: "Meeting transcripts, notes, recordings", url: "https://mcp.granola.ai/mcp", type: "streamable-http", website: "https://granola.ai", auth: "oauth" },
  { name: "Sentry", description: "Error tracking, performance monitoring, release health", url: "https://mcp.sentry.dev/mcp", type: "streamable-http", website: "https://sentry.io", auth: "oauth" },
  { name: "Cloudflare", description: "Workers, KV, R2, DNS, analytics", url: "https://mcp.cloudflare.com/mcp", type: "streamable-http", website: "https://cloudflare.com", auth: "oauth" },
  { name: "Stripe", description: "Payments, subscriptions, invoices, customers", url: "https://mcp.stripe.com/mcp", type: "streamable-http", website: "https://stripe.com", auth: "oauth" },
  { name: "Resend", description: "Send emails, manage domains, API keys", url: "https://mcp.resend.com/mcp", type: "streamable-http", website: "https://resend.com", auth: "bearer" },
  { name: "Supabase", description: "Database, auth, storage, edge functions", url: "https://mcp.supabase.com/mcp", type: "streamable-http", website: "https://supabase.com", auth: "bearer" },
  { name: "Neon", description: "Serverless Postgres — branches, queries, schemas", url: "https://mcp.neon.tech/mcp", type: "streamable-http", website: "https://neon.tech", auth: "oauth" },
  { name: "Browserbase", description: "Cloud browser automation, screenshots, scraping", url: "https://mcp.browserbase.com/mcp", type: "streamable-http", website: "https://browserbase.com", auth: "bearer" },
  { name: "Firecrawl", description: "Web scraping, crawling, content extraction", url: "https://mcp.firecrawl.dev/mcp", type: "streamable-http", website: "https://firecrawl.dev", auth: "bearer" },
];

/**
 * Normalize an official registry entry into our unified shape.
 */
function normalizeRegistryEntry(entry: {
  server: {
    name: string;
    description?: string;
    remotes?: { url: string; type: string }[];
    websiteUrl?: string;
  };
}): RegistryServer | null {
  const { server } = entry;
  const remote = server.remotes?.[0];
  if (!remote?.url) return null;

  return {
    name: server.name,
    description: server.description ?? "",
    url: remote.url,
    type: remote.type ?? "streamable-http",
    website: server.websiteUrl ?? "",
    auth: "oauth", // registry servers default to oauth
  };
}

/**
 * Simple case-insensitive substring match against name + description.
 */
function matchesQuery(server: RegistryServer, query: string): boolean {
  if (!query) return true;
  const lq = query.toLowerCase();
  return (
    server.name.toLowerCase().includes(lq) ||
    server.description.toLowerCase().includes(lq)
  );
}

/**
 * GET /api/mcp/registry?q=github
 * Searches the official MCP registry + our curated list.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  // Fetch from official registry (with timeout so we don't block forever)
  let registryServers: RegistryServer[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("https://registry.modelcontextprotocol.io/v0/servers", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 300 }, // cache for 5 min
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const entries: { server: { name: string; description?: string; remotes?: { url: string; type: string }[]; websiteUrl?: string } }[] =
        data.servers ?? [];
      registryServers = entries
        .map(normalizeRegistryEntry)
        .filter((s): s is RegistryServer => s !== null);
    }
  } catch {
    // Registry unavailable — fall through to curated list only
  }

  // Merge: curated entries override registry entries by name (case-insensitive)
  const curatedNames = new Set(CURATED_SERVERS.map((s) => s.name.toLowerCase()));
  const fromRegistry = registryServers.filter(
    (s) => !curatedNames.has(s.name.toLowerCase())
  );
  const merged = [...CURATED_SERVERS, ...fromRegistry];

  // Filter by query
  const filtered = merged.filter((s) => matchesQuery(s, query));

  return NextResponse.json({ servers: filtered });
}
