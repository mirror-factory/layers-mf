"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plug,
  Server,
  RefreshCw,
  Loader2,
  WifiOff,
  Globe,
  Search,
  ExternalLink,
  KeyRound,
  Wrench,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MCPServer {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  auth_type?: string;
  oauth_authorize_url?: string;
  oauth_token_url?: string;
  oauth_client_id?: string;
  last_connected_at: string | null;
  error_message: string | null;
  discovered_tools: { name: string }[];
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Registry server type (from /api/mcp/registry)                      */
/* ------------------------------------------------------------------ */

interface RegistryServer {
  name: string;
  description: string;
  url: string;
  type: string;
  website: string;
  auth: "oauth" | "bearer" | "none";
}

const POPULAR_NAMES = new Set([
  "GitHub", "Granola", "Sentry", "Cloudflare", "Stripe",
  "Resend", "Supabase", "Neon", "Browserbase", "Firecrawl",
]);

/* ------------------------------------------------------------------ */
/*  PKCE Helpers                                                       */
/* ------------------------------------------------------------------ */

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ------------------------------------------------------------------ */
/*  Connected Connector Card (compact)                                 */
/* ------------------------------------------------------------------ */

type ConnectorStatus = "connected" | "disconnected" | "error";

function ConnectorCard({
  name,
  icon: Icon,
  status,
  type,
  lastActivity,
  description,
  errorMessage,
  toolCount,
  onDisconnect,
  onReconnect,
}: {
  name: string;
  icon: React.ElementType;
  status: ConnectorStatus;
  type: "API" | "MCP";
  lastActivity: string | null;
  description?: string;
  errorMessage?: string | null;
  toolCount?: number;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}) {
  const statusDot =
    status === "connected"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-destructive"
        : "bg-muted-foreground/40";

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDot)} />
          <Badge variant="outline" className="text-[10px] shrink-0">
            {type}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {description && (
            <p className="text-[11px] text-muted-foreground truncate">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
          {toolCount !== undefined && toolCount > 0 && (
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {toolCount} tool{toolCount !== 1 ? "s" : ""}
            </span>
          )}
          {lastActivity && (
            <span>Last used {new Date(lastActivity).toLocaleDateString()}</span>
          )}
          {errorMessage && status === "error" && (
            <span className="text-destructive truncate">{errorMessage}</span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {status === "connected" ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={onDisconnect}>
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnect
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={onReconnect}>
            <Plug className="h-3 w-3 mr-1" />
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

type ConnectorTab = "connected" | "browse" | "custom";

const CONNECTOR_TABS: { value: ConnectorTab; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "browse", label: "Browse MCPs" },
  { value: "custom", label: "Add Custom" },
];

/* ------------------------------------------------------------------ */
/*  ConnectorsView                                                     */
/* ------------------------------------------------------------------ */

interface ConnectorsViewProps {
  mcpServers: MCPServer[];
}

export function ConnectorsView({
  mcpServers,
}: ConnectorsViewProps) {
  const [tab, setTab] = useState<ConnectorTab>("connected");

  /* MCP gallery state */
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<RegistryServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [selectedServer, setSelectedServer] = useState<RegistryServer | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [bearerToken, setBearerToken] = useState("");
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [browseFilter, setBrowseFilter] = useState<"popular" | "all">("popular");
  const [authFilter, setAuthFilter] = useState<"all" | "oauth" | "bearer" | "none">("all");

  /* Custom server state */
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const connectedServerUrls = new Set(mcpServers.map((s) => s.url));

  const fetchRegistry = useCallback(async (q: string, pageNum: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("page", String(pageNum));
      const paramStr = params.toString();
      const res = await fetch(`/api/mcp/registry${paramStr ? `?${paramStr}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        const newServers: RegistryServer[] = data.servers ?? [];
        if (append) {
          setServers((prev) => {
            const urlSet = new Set(prev.map((s) => s.url));
            const unique = newServers.filter((s) => !urlSet.has(s.url));
            return [...prev, ...unique];
          });
        } else {
          setServers(newServers);
        }
        setTotalCount(data.totalCount ?? null);
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load registry when browse tab is first selected
  const [registryLoaded, setRegistryLoaded] = useState(false);
  useEffect(() => {
    if (tab === "browse" && !registryLoaded) {
      setRegistryLoaded(true);
      fetchRegistry("", 1, false);
    }
  }, [tab, registryLoaded, fetchRegistry]);

  // Debounced search
  useEffect(() => {
    if (tab !== "browse" || !registryLoaded) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchRegistry(query, 1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, tab, registryLoaded, fetchRegistry]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRegistry(query, nextPage, true);
  };

  const dedupedServers = Array.from(
    new Map(servers.map((s) => [s.url, s])).values()
  );
  const popularServers = dedupedServers.filter((s) => POPULAR_NAMES.has(s.name));
  const allServers = dedupedServers;
  const filteredByAuth = (list: typeof allServers) =>
    authFilter === "all" ? list : list.filter((s) => s.auth === authFilter);
  const displayServers = filteredByAuth(browseFilter === "popular" ? popularServers : allServers);

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const handleDisconnectMCP = async (id: string) => {
    // Optimistic removal from UI
    setRemovedIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/mcp-servers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    } catch (err) {
      console.error("[mcp] Disconnect failed:", err);
      setMcpError(err instanceof Error ? err.message : "Failed to disconnect");
      // Revert on failure
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReconnectMCP = async (id: string) => {
    const server = mcpServers.find((s) => s.id === id);
    if (!server) return;

    try {
      // Mark as active first
      await fetch(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      // If OAuth server, trigger the OAuth flow instead of just reloading
      if (server.auth_type === "oauth") {
        const registryServer: RegistryServer = {
          name: server.name,
          url: server.url,
          auth: "oauth",
          description: "",
          type: "mcp",
          website: "",
        };

        // If we already have OAuth config, use it directly
        if (server.oauth_authorize_url && server.oauth_client_id) {
          const codeVerifier = generateCodeVerifier();
          const codeChallenge = await generateCodeChallenge(codeVerifier);
          const callbackUrl = `${window.location.origin}/api/mcp/oauth/callback`;
          const stateObj = {
            serverId: id,
            tokenUrl: server.oauth_token_url ?? "",
            clientId: server.oauth_client_id,
            codeVerifier,
          };
          const state = btoa(JSON.stringify(stateObj))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const params = new URLSearchParams({
            response_type: "code",
            client_id: server.oauth_client_id,
            redirect_uri: callbackUrl,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
          });
          window.location.href = `${server.oauth_authorize_url}?${params}`;
          return;
        }

        // Otherwise discover OAuth and start flow
        await startOAuthFlow(id, registryServer);
        return;
      }

      window.location.reload();
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Reconnect failed");
    }
  };

  const handleConnectMCP = async (server: RegistryServer) => {
    setConnecting(true);
    setMcpError(null);
    try {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: server.name,
          url: server.url,
          auth_type: server.auth,
          bearer_token: server.auth === "bearer" ? bearerToken : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to add server" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();

      if (server.auth === "oauth") {
        await startOAuthFlow(data.id ?? data.server?.id, server);
      } else {
        setBearerToken("");
        setSelectedServer(null);
        setTab("connected");
        window.location.reload();
      }
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectCustom = async () => {
    if (!customName.trim() || !customUrl.trim()) return;
    setConnecting(true);
    setMcpError(null);
    try {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customName.trim(), url: customUrl.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to add server" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setCustomName("");
      setCustomUrl("");
      setTab("connected");
      window.location.reload();
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const startOAuthFlow = async (serverId: string, server: RegistryServer) => {
    try {
      // Use server-side proxy to avoid CORS on OAuth discovery
      const res = await fetch("/api/mcp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: server.url,
          appName: "Layers",
          callbackUrl: `${window.location.origin}/api/mcp/oauth/callback`,
        }),
      });
      if (!res.ok) throw new Error("OAuth discovery failed");
      const meta = await res.json();

      const authorizeUrl = meta.authorizeUrl ?? "";
      const tokenUrl = meta.tokenUrl ?? "";
      const clientId = meta.clientId || window.location.origin;

      await fetch(`/api/mcp-servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oauth_authorize_url: authorizeUrl,
          oauth_token_url: tokenUrl,
          oauth_client_id: clientId,
        }),
      });

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const callbackUrl = `${window.location.origin}/api/mcp/oauth/callback`;
      const stateObj = { serverId, tokenUrl, clientId, codeVerifier };
      const state = btoa(JSON.stringify(stateObj))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      window.location.href = `${authorizeUrl}?${params}`;
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "OAuth flow failed");
    }
  };

  const authBadgeVariant = (auth: string) => {
    if (auth === "oauth") return "default" as const;
    if (auth === "bearer") return "secondary" as const;
    return "outline" as const;
  };

  const totalConnected =
    mcpServers.filter((s) => s.is_active && !s.error_message).length;
  const totalConnectors = mcpServers.length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Plug className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">Connectors</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage your MCP server connections.
          {totalConnectors > 0 && (
            <span className="ml-1">
              {totalConnected} of {totalConnectors} active.
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b items-center">
        {CONNECTOR_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setSelectedServer(null);
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto -mb-px pb-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connected tab */}
      {tab === "connected" && (
        <>
          {totalConnectors === 0 ? (
            <div className="text-center py-16">
              <Plug className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                No connectors configured yet.
              </p>
              <button
                onClick={() => setTab("browse")}
                className="text-sm text-primary hover:underline"
              >
                Browse MCP servers to get started
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {mcpServers.filter((s) => !removedIds.has(s.id)).map((server) => {
                const mcpStatus: ConnectorStatus = server.error_message
                  ? "error"
                  : server.is_active
                    ? "connected"
                    : "disconnected";

                return (
                  <ConnectorCard
                    key={server.id}
                    name={server.name}
                    icon={Server}
                    status={mcpStatus}
                    type="MCP"
                    lastActivity={server.last_connected_at}
                    errorMessage={server.error_message}
                    toolCount={server.discovered_tools?.length ?? 0}
                    onDisconnect={() => handleDisconnectMCP(server.id)}
                    onReconnect={() => handleReconnectMCP(server.id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Browse MCPs tab */}
      {tab === "browse" && (
        <div className="space-y-4">
          {selectedServer ? (
            /* MCP Detail View */
            <div className="space-y-5">
              <button
                onClick={() => setSelectedServer(null)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to browse
              </button>

              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Globe className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedServer.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={authBadgeVariant(selectedServer.auth)} className="text-[10px] uppercase">
                      {selectedServer.auth}
                    </Badge>
                    {connectedServerUrls.has(selectedServer.url) && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                        Connected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{selectedServer.description}</p>

              {selectedServer.website && (
                <a
                  href={selectedServer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
                >
                  <ExternalLink className="h-3 w-3" />
                  {selectedServer.website.replace(/^https?:\/\//, "")}
                </a>
              )}

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium">Connection details</p>
                <p className="text-[11px] text-muted-foreground font-mono break-all">{selectedServer.url}</p>
                <p className="text-[11px] text-muted-foreground">
                  Transport: {selectedServer.type || "streamable-http"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Auth: {selectedServer.auth === "oauth" ? "OAuth 2.0 (PKCE)" : selectedServer.auth === "bearer" ? "Bearer token" : "None"}
                </p>
              </div>

              {/* Tools section */}
              {(() => {
                const connectedMcp = mcpServers.find((s) => s.url === selectedServer.url);
                const tools = connectedMcp?.discovered_tools ?? [];
                return tools.length > 0 ? (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> Available Tools ({tools.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map((tool) => (
                        <span
                          key={tool.name}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-mono"
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Connect to discover available tools.</p>
                );
              })()}

              {/* Connection instructions */}
              {selectedServer.auth === "oauth" && (
                <p className="text-xs text-muted-foreground">
                  This server uses OAuth 2.0 with PKCE. Clicking Connect will redirect you to authorize access.
                </p>
              )}

              {selectedServer.auth === "bearer" && !connectedServerUrls.has(selectedServer.url) && (
                <div className="space-y-2">
                  <label className="text-xs font-medium">Bearer Token</label>
                  <Input
                    type="password"
                    placeholder="Enter your API key or token"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                  />
                </div>
              )}

              {selectedServer.auth === "none" && (
                <p className="text-xs text-muted-foreground">
                  No authentication required. Click Connect to add this server.
                </p>
              )}

              {mcpError && (
                <p className="text-xs text-destructive">{mcpError}</p>
              )}

              {!connectedServerUrls.has(selectedServer.url) && (
                <Button
                  onClick={() => handleConnectMCP(selectedServer)}
                  disabled={connecting || (selectedServer.auth === "bearer" && !bearerToken.trim())}
                  className="w-full"
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : selectedServer.auth === "oauth" ? (
                    <KeyRound className="h-4 w-4 mr-2" />
                  ) : (
                    <Plug className="h-4 w-4 mr-2" />
                  )}
                  {connecting
                    ? "Connecting..."
                    : selectedServer.auth === "oauth"
                      ? "Connect with OAuth"
                      : "Connect"}
                </Button>
              )}
            </div>
          ) : (
            /* Browse Grid */
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search MCP servers..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBrowseFilter("popular")}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full font-medium transition-colors",
                    browseFilter === "popular"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Popular
                </button>
                <button
                  onClick={() => setBrowseFilter("all")}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full font-medium transition-colors",
                    browseFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({allServers.length})
                </button>
                {!loading && query && (
                  <p className="text-xs text-muted-foreground ml-2">
                    {displayServers.length}{totalCount !== null && totalCount > displayServers.length ? ` of ${totalCount}` : ""} results
                  </p>
                )}
              </div>

              {/* Auth type filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground mr-1">Auth:</span>
                {(["all", "oauth", "bearer", "none"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAuthFilter(type)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded font-medium transition-colors capitalize",
                      authFilter === type
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {type === "all" ? "All types" : type === "bearer" ? "API Key" : type === "oauth" ? "OAuth" : "No Auth"}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : displayServers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    No servers found{query ? ` for "${query}"` : ""}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {displayServers.map((server) => {
                      const isConnected = connectedServerUrls.has(server.url);
                      return (
                        <button
                          key={server.url}
                          onClick={() => {
                            setSelectedServer(server);
                            setMcpError(null);
                            setBearerToken("");
                          }}
                          className={cn(
                            "flex flex-col gap-2 rounded-lg border p-4 text-left transition-all",
                            "hover:bg-accent/50 hover:border-foreground/10",
                            isConnected && "border-emerald-500/30 bg-emerald-500/5",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <span className="text-sm font-medium">{server.name}</span>
                                {isConnected && (
                                  <Badge variant="outline" className="ml-2 text-[9px] border-emerald-500/30 text-emerald-400">
                                    Connected
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Badge variant={authBadgeVariant(server.auth)} className="text-[10px] shrink-0 uppercase">
                              {server.auth}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{server.description}</p>
                          <div className="flex items-center gap-2 mt-auto">
                            {server.website && (
                              <span className="text-[10px] text-muted-foreground/60 truncate">{server.website.replace(/^https?:\/\//, "")}</span>
                            )}
                            <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-auto shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {browseFilter === "all" && hasMore && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {loadingMore ? "Loading..." : "Load more"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Custom tab */}
      {tab === "custom" && (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">
            Add any MCP server by URL. Supports streamable-http and SSE transports.
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Server name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <Input
              placeholder="https://mcp.example.com/mcp"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
          </div>
          {mcpError && (
            <p className="text-xs text-destructive">{mcpError}</p>
          )}
          <Button
            onClick={handleConnectCustom}
            disabled={connecting || !customName.trim() || !customUrl.trim()}
            variant="outline"
            className="w-full"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Server className="h-4 w-4 mr-2" />
            )}
            {connecting ? "Adding..." : "Add MCP Server"}
          </Button>
        </div>
      )}
    </div>
  );
}
