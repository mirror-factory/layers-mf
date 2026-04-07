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
];

const PAGE_SIZE = 50;

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
 * Normalize a Smithery registry entry into our unified shape.
 */
function normalizeSmitheryEntry(entry: {
  displayName: string;
  description?: string;
  qualifiedName: string;
  homepage?: string;
  remote?: boolean;
}): RegistryServer | null {
  // Smithery servers that are "remote" have a hosted URL
  const url = entry.remote
    ? `https://server.smithery.ai/${entry.qualifiedName}/mcp`
    : "";
  if (!url) return null;

  return {
    name: entry.displayName || entry.qualifiedName,
    description: entry.description ?? "",
    url,
    type: "streamable-http",
    website: entry.homepage || `https://smithery.ai/servers/${entry.qualifiedName}`,
    auth: "none",
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
 * Fetch servers from Smithery registry.
 */
async function fetchSmithery(query: string, page: number): Promise<{
  servers: RegistryServer[];
  totalCount: number;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const params = new URLSearchParams({
      pageSize: String(PAGE_SIZE),
      page: String(page),
    });
    if (query) params.set("q", query);

    const res = await fetch(
      `https://registry.smithery.ai/servers?${params}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return { servers: [], totalCount: 0 };

    const data = await res.json();
    const entries: Array<{
      displayName: string;
      description?: string;
      qualifiedName: string;
      homepage?: string;
      remote?: boolean;
    }> = data.servers ?? [];

    const servers = entries
      .map(normalizeSmitheryEntry)
      .filter((s): s is RegistryServer => s !== null);

    const totalCount = data.pagination?.totalCount ?? servers.length;

    return { servers, totalCount };
  } catch {
    return { servers: [], totalCount: 0 };
  }
}

/**
 * Fetch from official MCP registry.
 */
async function fetchOfficialRegistry(): Promise<RegistryServer[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("https://registry.modelcontextprotocol.io/v0/servers", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 300 }, // cache for 5 min
    });
    clearTimeout(timeout);

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

    return entries
      .map(normalizeRegistryEntry)
      .filter((s): s is RegistryServer => s !== null);
  } catch {
    return [];
  }
}

/**
 * GET /api/mcp/registry?q=github&page=1
 * Searches the official MCP registry, Smithery, and our curated list.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));

  // Fetch from all sources in parallel
  const [officialServers, smitheryResult] = await Promise.all([
    fetchOfficialRegistry(),
    fetchSmithery(query, page),
  ]);

  // Merge: curated entries override others by URL
  const seen = new Map<string, RegistryServer>();

  // Add curated first (highest priority)
  for (const s of CURATED_SERVERS) {
    if (matchesQuery(s, query)) {
      seen.set(s.url, s);
    }
  }

  // Add official registry (skip if URL already present)
  for (const s of officialServers) {
    if (!seen.has(s.url) && matchesQuery(s, query)) {
      seen.set(s.url, s);
    }
  }

  // Add Smithery results (skip if URL already present)
  for (const s of smitheryResult.servers) {
    if (!seen.has(s.url)) {
      seen.set(s.url, s);
    }
  }

  const merged = Array.from(seen.values());

  // Estimate if there are more pages from Smithery
  const smitheryTotalCount = smitheryResult.totalCount;
  const hasMore = page * PAGE_SIZE < smitheryTotalCount;

  return NextResponse.json({
    servers: merged,
    totalCount: smitheryTotalCount + CURATED_SERVERS.length + officialServers.length,
    hasMore,
    page,
  });
}
