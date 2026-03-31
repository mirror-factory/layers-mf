"use client";

import { useState, useEffect, useCallback } from "react";
import { Plug, Loader2, CheckCircle2, XCircle, Plus, ExternalLink, KeyRound, ChevronDown } from "lucide-react";
import { MCPServerCard } from "@/components/mcp-server-card";
import { cn } from "@/lib/utils";

/* ─── Recommended MCP Servers ─── */

interface RecommendedServer {
  name: string;
  url: string;
  icon: string;
  description: string;
  toolCount: number;
  auth: "oauth" | "bearer" | "none";
  comingSoon?: boolean;
}

const RECOMMENDED_SERVERS: RecommendedServer[] = [
  {
    name: "GitHub",
    url: "https://api.githubcopilot.com/mcp/",
    icon: "\uD83D\uDC19",
    description: "Repos, PRs, issues, commits, Actions, releases",
    toolCount: 15,
    auth: "oauth",
  },
  {
    name: "Granola",
    url: "https://mcp.granola.ai/mcp",
    icon: "\uD83C\uDF99\uFE0F",
    description: "Meeting transcripts, notes, and recordings",
    toolCount: 5,
    auth: "oauth",
  },
  {
    name: "Slack",
    url: "https://mcp.slack.com/mcp",
    icon: "\uD83D\uDCAC",
    description: "Channels, messages, threads, search",
    toolCount: 10,
    auth: "oauth",
    comingSoon: true,
  },
  {
    name: "Google Drive",
    url: "https://mcp.googleapis.com/drive/mcp",
    icon: "\uD83D\uDCC1",
    description: "Files, docs, sheets, presentations",
    toolCount: 8,
    auth: "oauth",
    comingSoon: true,
  },
  {
    name: "Notion",
    url: "https://mcp.notion.so/mcp",
    icon: "\uD83D\uDCDD",
    description: "Pages, databases, blocks, search",
    toolCount: 10,
    auth: "oauth",
    comingSoon: true,
  },
  {
    name: "Linear",
    url: "https://mcp.linear.app/mcp",
    icon: "\u26A1",
    description: "Issues, projects, cycles, teams",
    toolCount: 12,
    auth: "oauth",
    comingSoon: true,
  },
];

type AuthType = "none" | "bearer" | "oauth";

interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport_type: "http" | "sse";
  auth_type: AuthType;
  is_active: boolean;
  discovered_tools: { name: string }[];
  last_connected_at: string | null;
  error_message: string | null;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; toolCount: number; toolNames: string[] }
  | { status: "error"; message: string };

export default function MCPSettingsPage() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [authType, setAuthType] = useState<AuthType>("bearer");
  const [transportType, setTransportType] = useState<"http" | "sse">("http");
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // OAuth config
  const [oauthAuthorizeUrl, setOauthAuthorizeUrl] = useState("");
  const [oauthTokenUrl, setOauthTokenUrl] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [discovering, setDiscovering] = useState(false);

  // Marketplace state
  const [guideOpen, setGuideOpen] = useState(false);
  const [connectingServer, setConnectingServer] = useState<string | null>(null);

  // Show success/error from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    if (success) {
      setTestState({ status: "success", toolCount: 0, toolNames: [] });
      window.history.replaceState({}, "", "/mcp");
    } else if (error) {
      setFormError(error);
      window.history.replaceState({}, "", "/mcp");
    }
  }, []);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp-servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
      }
    } catch {
      // Silently fail — servers list just stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleDiscoverOAuth = async () => {
    if (!url.trim()) {
      setFormError("URL is required to discover OAuth endpoints");
      return;
    }
    setDiscovering(true);
    setFormError("");
    try {
      const serverOrigin = new URL(url.trim()).origin;
      const res = await fetch(`${serverOrigin}/.well-known/oauth-authorization-server`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const meta = await res.json();
        if (meta.authorization_endpoint) setOauthAuthorizeUrl(meta.authorization_endpoint);
        if (meta.token_endpoint) setOauthTokenUrl(meta.token_endpoint);
      } else {
        setFormError("OAuth discovery not available — enter endpoints manually");
      }
    } catch {
      setFormError("OAuth discovery failed — enter endpoints manually");
    } finally {
      setDiscovering(false);
    }
  };

  const handleTest = async () => {
    if (!url.trim()) {
      setFormError("URL is required");
      return;
    }
    setFormError("");
    setTestState({ status: "testing" });

    try {
      const res = await fetch("/api/mcp-servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), apiKey: apiKey || undefined, transportType, authType }),
      });
      const data = await res.json();
      if (data.success) {
        setTestState({ status: "success", toolCount: data.toolCount, toolNames: data.toolNames });
      } else {
        setTestState({ status: "error", message: data.error || "Connection failed" });
      }
    } catch (err) {
      setTestState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) {
      setFormError("Name and URL are required");
      return;
    }
    setFormError("");
    setSaving(true);

    try {
      // For OAuth: discover, register, save, and redirect — all in one click
      if (authType === "oauth") {
        let authorizeUrl = oauthAuthorizeUrl;
        let tokenUrl = oauthTokenUrl;
        let clientId = oauthClientId;

        // Step 1: Auto-discover OAuth endpoints via server-side proxy (avoids CORS)
        if (!authorizeUrl) {
          try {
            const discoverRes = await fetch("/api/mcp/discover", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                serverUrl: url.trim(),
                appName: name.trim() || "Granger",
                callbackUrl: `${window.location.origin}/api/mcp/oauth/callback`,
              }),
            });
            if (discoverRes.ok) {
              const discovered = await discoverRes.json();
              authorizeUrl = discovered.authorizeUrl ?? "";
              tokenUrl = discovered.tokenUrl ?? "";
              clientId = discovered.clientId ?? "";
            }
          } catch {
            // Discovery failed — check if user provided manual config
          }
        }

        if (!authorizeUrl || !clientId) {
          setFormError("Could not auto-discover OAuth endpoints. Please enter them manually in the OAuth Configuration section above.");
          setSaving(false);
          return;
        }

        // Step 3: Save server with discovered config
        const res = await fetch("/api/mcp-servers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            url: url.trim(),
            authType: "oauth",
            transportType,
            oauthAuthorizeUrl: authorizeUrl,
            oauthTokenUrl: tokenUrl,
            oauthClientId: clientId,
            oauthClientSecret: oauthClientSecret || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to add server");
          setSaving(false);
          return;
        }

        // Step 4: Generate PKCE and redirect to OAuth provider
        const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0")).join("");
        const codeChallenge = btoa(
          String.fromCharCode(...new Uint8Array(
            await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))
          ))
        ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        const callbackUrl = `${window.location.origin}/api/mcp/oauth/callback`;
        const stateObj = {
          serverId: data.server.id,
          tokenUrl,
          clientId,
          codeVerifier,
        };
        const state = btoa(JSON.stringify(stateObj))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        const params = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: callbackUrl,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          scope: "openid profile email offline_access",
        });

        // Redirect to OAuth provider — user logs in there
        window.location.href = `${authorizeUrl}?${params}`;
        return;
      }

      // Non-OAuth: original flow
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          apiKey: apiKey || undefined,
          authType,
          transportType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setName("");
        setUrl("");
        setApiKey("");
        setAuthType("bearer");
        setTransportType("http");
        setOauthAuthorizeUrl("");
        setOauthTokenUrl("");
        setOauthClientId("");
        setOauthClientSecret("");
        setTestState({ status: "idle" });
        fetchServers();
      } else {
        setFormError(data.error || "Failed to add server");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    // Optimistic update
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: active } : s))
    );
    try {
      await fetch(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
    } catch {
      // Revert on failure
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !active } : s))
      );
    }
  };

  const handleDelete = async (id: string) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/mcp-servers/${id}`, { method: "DELETE" });
    } catch {
      fetchServers(); // Refetch on failure
    }
  };

  const isServerConnected = (serverUrl: string) =>
    servers.some((s) => s.url === serverUrl);

  const handleConnectRecommended = async (server: RecommendedServer) => {
    if (server.comingSoon || isServerConnected(server.url)) return;
    setConnectingServer(server.url);
    setFormError("");

    try {
      // Step 1: Discover OAuth endpoints
      let authorizeUrl = "";
      let tokenUrl = "";
      let clientId = "";

      const discoverRes = await fetch("/api/mcp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: server.url,
          appName: server.name,
          callbackUrl: `${window.location.origin}/api/mcp/oauth/callback`,
        }),
      });
      if (discoverRes.ok) {
        const discovered = await discoverRes.json();
        authorizeUrl = discovered.authorizeUrl ?? "";
        tokenUrl = discovered.tokenUrl ?? "";
        clientId = discovered.clientId ?? "";
      }

      if (!authorizeUrl || !clientId) {
        setFormError(`Could not auto-discover OAuth for ${server.name}. Try adding it manually below.`);
        setConnectingServer(null);
        return;
      }

      // Step 2: Save server
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: server.name,
          url: server.url,
          authType: "oauth",
          transportType: "http",
          oauthAuthorizeUrl: authorizeUrl,
          oauthTokenUrl: tokenUrl,
          oauthClientId: clientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || `Failed to save ${server.name}`);
        setConnectingServer(null);
        return;
      }

      // Step 3: PKCE + redirect
      const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const codeChallenge = btoa(
        String.fromCharCode(...new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))
        ))
      ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const callbackUrl = `${window.location.origin}/api/mcp/oauth/callback`;
      const stateObj = {
        serverId: data.server.id,
        tokenUrl,
        clientId,
        codeVerifier,
      };
      const state = btoa(JSON.stringify(stateObj))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        scope: "openid profile email offline_access",
      });

      window.location.href = `${authorizeUrl}?${params}`;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Network error");
      setConnectingServer(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Plug className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">MCP Servers</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Connect external tools to Granger via the Model Context Protocol.
        </p>
      </div>

      {/* How MCP Works — collapsible */}
      <div className="mb-6 rounded-lg border bg-card">
        <button
          onClick={() => setGuideOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
        >
          <span>How MCP Works</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              guideOpen && "rotate-180"
            )}
          />
        </button>
        {guideOpen && (
          <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2 border-t pt-3">
            <ul className="space-y-1.5 text-xs">
              <li><strong className="text-foreground">Free &amp; open protocol</strong> — MCP is an open standard with no licensing costs.</li>
              <li><strong className="text-foreground">One-click OAuth</strong> — connect with a single click, no API keys needed.</li>
              <li><strong className="text-foreground">Tools on demand</strong> — each server gives Granger new tools (listed on the card). Tools are called on-demand, not loaded into memory.</li>
              <li><strong className="text-foreground">Lightweight</strong> — only tool definitions (~50-150 tokens each) are sent per message.</li>
              <li><strong className="text-foreground">Flexible</strong> — connect or disconnect servers anytime via the toggle.</li>
            </ul>
            <a
              href="https://smithery.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
            >
              Browse 2000+ MCP servers on Smithery
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Recommended MCP Servers — Marketplace */}
      <div className="mb-6">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Recommended MCP Servers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect to popular services with one click — completely free
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {RECOMMENDED_SERVERS.map((server) => {
            const connected = isServerConnected(server.url);
            const connecting = connectingServer === server.url;
            return (
              <div
                key={server.url}
                className="rounded-lg border bg-card p-4 flex items-start gap-3"
              >
                <span className="text-2xl shrink-0 mt-0.5">{server.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{server.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {server.toolCount} tools
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 font-medium">
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {server.description}
                  </p>
                </div>
                <div className="shrink-0">
                  {connected ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-md">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                  ) : server.comingSoon ? (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md">
                      Coming Soon
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConnectRecommended(server)}
                      disabled={connecting}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plug className="h-3 w-3" />
                      )}
                      {connecting ? "Connecting..." : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Server Form */}
      <div className="rounded-lg border p-4 mb-6 space-y-4">
        <p className="font-medium text-sm">Add Server</p>

        <div className="grid gap-3">
          <div>
            <label htmlFor="mcp-name" className="text-xs font-medium text-muted-foreground block mb-1">
              Name
            </label>
            <input
              id="mcp-name"
              type="text"
              placeholder="e.g. Weather Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="mcp-url" className="text-xs font-medium text-muted-foreground block mb-1">
              Server URL
            </label>
            <input
              id="mcp-url"
              type="url"
              placeholder="https://example.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="mcp-auth-type" className="text-xs font-medium text-muted-foreground block mb-1">
              Authentication
            </label>
            <select
              id="mcp-auth-type"
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="none">None</option>
              <option value="bearer">API Key</option>
              <option value="oauth">OAuth</option>
            </select>
          </div>

          {authType === "bearer" && (
            <div>
              <label htmlFor="mcp-apikey" className="text-xs font-medium text-muted-foreground block mb-1">
                API Key
              </label>
              <input
                id="mcp-apikey"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {authType === "oauth" && (
            <div className="space-y-3 rounded-md border border-dashed p-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-medium text-foreground text-xs">OAuth — Auto-configured</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Just enter the name and URL above, then click &quot;Save & Connect with OAuth&quot;.
                    Granger will auto-discover the OAuth server, register, and redirect you to log in.
                  </p>
                </div>
              </div>
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                  Advanced: manual OAuth configuration
                </summary>
                <div className="mt-2 space-y-2">
              <div>
                <label htmlFor="oauth-authorize-url" className="text-xs font-medium text-muted-foreground block mb-1">
                  Authorize URL
                </label>
                <input
                  id="oauth-authorize-url"
                  type="url"
                  placeholder="https://provider.com/oauth/authorize"
                  value={oauthAuthorizeUrl}
                  onChange={(e) => setOauthAuthorizeUrl(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="oauth-token-url" className="text-xs font-medium text-muted-foreground block mb-1">
                  Token URL
                </label>
                <input
                  id="oauth-token-url"
                  type="url"
                  placeholder="https://provider.com/oauth/token"
                  value={oauthTokenUrl}
                  onChange={(e) => setOauthTokenUrl(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="oauth-client-id" className="text-xs font-medium text-muted-foreground block mb-1">
                  Client ID
                </label>
                <input
                  id="oauth-client-id"
                  type="text"
                  placeholder="your-client-id"
                  value={oauthClientId}
                  onChange={(e) => setOauthClientId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="oauth-client-secret" className="text-xs font-medium text-muted-foreground block mb-1">
                  Client Secret <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="oauth-client-secret"
                  type="password"
                  placeholder="your-client-secret"
                  value={oauthClientSecret}
                  onChange={(e) => setOauthClientSecret(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              </div>
              </details>
            </div>
          )}

          <div>
            <label htmlFor="mcp-transport" className="text-xs font-medium text-muted-foreground block mb-1">
              Transport
            </label>
            <select
              id="mcp-transport"
              value={transportType}
              onChange={(e) => setTransportType(e.target.value as "http" | "sse")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="http">HTTP (Streamable HTTP)</option>
              <option value="sse">SSE (Server-Sent Events)</option>
            </select>
          </div>
        </div>

        {/* Test result */}
        {testState.status === "success" && (
          <div className="flex items-start gap-2 rounded-md bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Connected — {testState.toolCount} tool{testState.toolCount !== 1 ? "s" : ""} discovered
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {testState.toolNames.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 font-mono"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {testState.status === "error" && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{testState.message}</p>
          </div>
        )}

        {formError && (
          <p className="text-sm text-destructive">{formError}</p>
        )}

        {/* Buttons — different for OAuth vs other auth types */}
        <div className="flex gap-2">
          {authType !== "oauth" && (
            <button
              onClick={handleTest}
              disabled={testState.status === "testing" || !url.trim()}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testState.status === "testing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              Test Connection
            </button>
          )}

          <button
            onClick={handleAdd}
            disabled={saving || !name.trim() || !url.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {authType === "oauth" ? "Save & Connect with OAuth" : "Add Server"}
          </button>
        </div>

        {authType === "oauth" && (
          <p className="text-xs text-muted-foreground">
            Click &quot;Save &amp; Connect with OAuth&quot; — Granger will auto-discover the OAuth server and redirect you to log in.
          </p>
        )}
      </div>

      {/* Servers List */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Connected Servers {!loading && `(${servers.length})`}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Plug className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No MCP servers connected yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a server above to extend Granger with external tools.
            </p>
          </div>
        ) : (
          servers.map((server) => (
            <MCPServerCard
              key={server.id}
              server={server}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdate={fetchServers}
            />
          ))
        )}
      </div>
    </div>
  );
}
