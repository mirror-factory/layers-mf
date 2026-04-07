"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plug,
  Server,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  AlertCircle,
  HardDrive,
  Github,
  Hash,
  BarChart3,
  Mail,
  StickyNote,
  Globe,
  Mic,
  GitBranch,
  Upload,
  Bot,
  Plus,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MCPServer {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  last_connected_at: string | null;
  error_message: string | null;
  discovered_tools: { name: string }[];
}

interface Credential {
  id: string;
  provider: string;
  status: string;
  last_used_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  Provider metadata                                                  */
/* ------------------------------------------------------------------ */

const PROVIDER_META: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  granola: { label: "Granola", icon: Mic, description: "Meeting transcripts and notes" },
  linear: { label: "Linear", icon: GitBranch, description: "Issues, projects, and cycles" },
  "google-drive": { label: "Google Drive", icon: HardDrive, description: "Documents and files" },
  github: { label: "GitHub", icon: Github, description: "Repositories and issues" },
  "github-app": { label: "GitHub", icon: Github, description: "Repositories and issues" },
  slack: { label: "Slack", icon: Hash, description: "Messages and channels" },
  gmail: { label: "Gmail", icon: Mail, description: "Email threads and messages" },
  notion: { label: "Notion", icon: StickyNote, description: "Pages, databases, and wiki content" },
  "layers-ai": { label: "Layers AI", icon: Bot, description: "Built-in AI assistant tools" },
  upload: { label: "Upload", icon: Upload, description: "Uploaded files and documents" },
};

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
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {status === "connected" ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDisconnect}>
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnect
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onReconnect}>
            <Plug className="h-3 w-3 mr-1" />
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MCP Gallery Panel                                                  */
/* ------------------------------------------------------------------ */

function MCPGalleryPanel({
  open,
  onOpenChange,
  connectedServerUrls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedServerUrls: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<RegistryServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<RegistryServer | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [bearerToken, setBearerToken] = useState("");
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const fetchRegistry = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/mcp/registry${params}`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchRegistry("");
    }
  }, [open, fetchRegistry]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      fetchRegistry(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open, fetchRegistry]);

  const popularServers = servers.filter((s) => POPULAR_NAMES.has(s.name));
  const allServers = servers;

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
        onOpenChange(false);
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
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const startOAuthFlow = async (serverId: string, server: RegistryServer) => {
    try {
      const origin = new URL(server.url).origin;
      const res = await fetch(`${origin}/.well-known/oauth-authorization-server`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("OAuth discovery failed");
      const meta = await res.json();

      const authorizeUrl = meta.authorization_endpoint ?? "";
      const tokenUrl = meta.token_endpoint ?? "";
      const registrationEndpoint = meta.registration_endpoint ?? "";
      let clientId = meta.client_id ?? "";

      if (registrationEndpoint && !clientId) {
        const regRes = await fetch(registrationEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: "Layers",
            redirect_uris: [`${window.location.origin}/api/mcp/oauth/callback`],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
          }),
        });
        if (regRes.ok) {
          const regData = await regRes.json();
          clientId = regData.client_id ?? "";
        }
      }

      if (!clientId) clientId = window.location.origin;

      // Save OAuth config
      await fetch(`/api/mcp-servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oauth_authorize_url: authorizeUrl,
          oauth_token_url: tokenUrl,
          oauth_client_id: clientId,
        }),
      });

      // Start PKCE flow
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

  const renderServerCard = (server: RegistryServer) => {
    const isConnected = connectedServerUrls.has(server.url);
    return (
      <button
        key={server.name + server.url}
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
  };

  const renderServerDetail = (server: RegistryServer) => {
    const isConnected = connectedServerUrls.has(server.url);
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setSelectedServer(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to gallery
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Globe className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{server.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={authBadgeVariant(server.auth)} className="text-[10px] uppercase">
                {server.auth}
              </Badge>
              {isConnected && (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                  Connected
                </Badge>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{server.description}</p>

        {server.website && (
          <a
            href={server.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
          >
            <ExternalLink className="h-3 w-3" />
            {server.website.replace(/^https?:\/\//, "")}
          </a>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium">Connection details</p>
          <p className="text-[11px] text-muted-foreground font-mono break-all">{server.url}</p>
          <p className="text-[11px] text-muted-foreground">
            Transport: {server.type || "streamable-http"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Auth: {server.auth === "oauth" ? "OAuth 2.0 (PKCE)" : server.auth === "bearer" ? "Bearer token" : "None"}
          </p>
        </div>

        {server.auth === "bearer" && !isConnected && (
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

        {mcpError && (
          <p className="text-xs text-destructive">{mcpError}</p>
        )}

        {!isConnected && (
          <Button
            onClick={() => handleConnectMCP(server)}
            disabled={connecting || (server.auth === "bearer" && !bearerToken.trim())}
            className="w-full"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : server.auth === "oauth" ? (
              <KeyRound className="h-4 w-4 mr-2" />
            ) : (
              <Plug className="h-4 w-4 mr-2" />
            )}
            {connecting
              ? "Connecting..."
              : server.auth === "oauth"
                ? "Connect with OAuth"
                : "Connect"}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle>MCP Gallery</SheetTitle>
          <SheetDescription>
            Browse and connect MCP servers to extend your AI with tools.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            {selectedServer ? (
              renderServerDetail(selectedServer)
            ) : (
              <div className="space-y-4">
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

                <Tabs defaultValue="popular" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="popular" className="flex-1">Popular</TabsTrigger>
                    <TabsTrigger value="all" className="flex-1">All ({allServers.length})</TabsTrigger>
                    <TabsTrigger value="custom" className="flex-1">Custom URL</TabsTrigger>
                  </TabsList>

                  <TabsContent value="popular" className="mt-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : popularServers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No popular servers found.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {popularServers.map(renderServerCard)}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="mt-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : allServers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No servers found{query ? ` for "${query}"` : ""}.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {allServers.map(renderServerCard)}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="custom" className="mt-4">
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">
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
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  ConnectorsView                                                     */
/* ------------------------------------------------------------------ */

interface ConnectorsViewProps {
  mcpServers: MCPServer[];
  credentials: Credential[];
}

export function ConnectorsView({
  mcpServers,
  credentials,
}: ConnectorsViewProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const connectedServerUrls = new Set(mcpServers.map((s) => s.url));

  const handleDisconnectMCP = async (id: string) => {
    try {
      await fetch(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      window.location.reload();
    } catch {
      // silent
    }
  };

  const handleReconnectMCP = async (id: string) => {
    try {
      await fetch(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      window.location.reload();
    } catch {
      // silent
    }
  };

  const totalConnected =
    credentials.filter((c) => c.status === "active").length +
    mcpServers.filter((s) => s.is_active && !s.error_message).length;
  const totalConnectors = credentials.length + mcpServers.length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <MCPGalleryPanel
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        connectedServerUrls={connectedServerUrls}
      />

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Plug className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">Connectors</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage your MCP servers and API connections.
          {totalConnectors > 0 && (
            <span className="ml-1">
              {totalConnected} of {totalConnectors} active.
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <Button onClick={() => setGalleryOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connector
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Connected services */}
      {totalConnectors === 0 ? (
        <div className="text-center py-16">
          <Plug className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">
            No connectors configured yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Add an MCP server or API connection to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Credentials (API connections) */}
          {credentials.map((cred) => {
            const meta = PROVIDER_META[cred.provider];
            const credStatus: ConnectorStatus =
              cred.status === "active" ? "connected" : "disconnected";

            return (
              <ConnectorCard
                key={cred.id}
                name={meta?.label ?? cred.provider}
                icon={meta?.icon ?? Plug}
                description={meta?.description}
                status={credStatus}
                type="API"
                lastActivity={cred.last_used_at}
              />
            );
          })}

          {/* MCP Servers */}
          {mcpServers.map((server) => {
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
    </div>
  );
}
