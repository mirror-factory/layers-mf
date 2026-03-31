"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Trash2, ChevronDown, ChevronRight, Wrench, Globe, Zap, KeyRound, Search, Loader2 } from "lucide-react";

/* ─── PKCE Helpers ─── */

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

interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport_type: "http" | "sse";
  auth_type?: "bearer" | "oauth" | "none";
  is_active: boolean;
  discovered_tools: { name: string }[];
  last_connected_at: string | null;
  error_message: string | null;
  oauth_authorize_url?: string | null;
  oauth_token_url?: string | null;
  oauth_client_id?: string | null;
  oauth_client_secret?: string | null;
}

export function MCPServerCard({
  server,
  onToggle,
  onDelete,
  onUpdate,
}: {
  server: MCPServer;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showOAuthConfig, setShowOAuthConfig] = useState(false);
  const [oauthForm, setOauthForm] = useState({
    authorizeUrl: server.oauth_authorize_url ?? "",
    tokenUrl: server.oauth_token_url ?? "",
    clientId: server.oauth_client_id ?? "",
    clientSecret: server.oauth_client_secret ?? "",
  });
  const [discovering, setDiscovering] = useState(false);
  const [savingOAuth, setSavingOAuth] = useState(false);
  const [autoDiscoveryDone, setAutoDiscoveryDone] = useState(false);
  const [autoDiscoveryFailed, setAutoDiscoveryFailed] = useState(false);
  const discoveryRan = useRef(false);

  // Re-run discovery if: no config, or client_id looks like a URL (stale fallback), or no last_connected
  const hasStaleClientId = server.oauth_client_id?.startsWith("http") ?? false;
  const needsOAuthSetup =
    server.auth_type === "oauth" &&
    !server.last_connected_at &&
    (!server.oauth_authorize_url || hasStaleClientId);

  const handleAutoDiscover = useCallback(async () => {
    setDiscovering(true);
    setAutoDiscoveryFailed(false);
    try {
      const origin = new URL(server.url).origin;
      const res = await fetch(`${origin}/.well-known/oauth-authorization-server`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const meta = await res.json();
        const authorizeUrl = meta.authorization_endpoint ?? "";
        const tokenUrl = meta.token_endpoint ?? "";
        const registrationEndpoint = meta.registration_endpoint ?? "";
        let clientId = meta.client_id ?? "";

        // Dynamic Client Registration: if a registration_endpoint is provided
        // and we don't already have a clientId, register a new client
        if (registrationEndpoint && !clientId) {
          try {
            const regRes = await fetch(registrationEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_name: "Granger",
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
          } catch {
            // Registration failed — fall back to origin as clientId
          }
        }

        if (!clientId) {
          clientId = window.location.origin;
        }

        if (authorizeUrl) {
          setOauthForm((prev) => ({
            ...prev,
            authorizeUrl,
            tokenUrl: tokenUrl || prev.tokenUrl,
            clientId: clientId || prev.clientId,  // Prefer freshly registered clientId
          }));
          setAutoDiscoveryDone(true);

          // Auto-save discovered config to the server
          try {
            await fetch(`/api/mcp-servers/${server.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                oauth_authorize_url: authorizeUrl,
                oauth_token_url: tokenUrl,
                oauth_client_id: clientId,
                oauth_client_secret: null,
              }),
            });
            onUpdate?.();
          } catch {
            // Save failed but discovery succeeded — user can still connect
          }
          return;
        }
      }
      setAutoDiscoveryFailed(true);
    } catch {
      setAutoDiscoveryFailed(true);
    } finally {
      setDiscovering(false);
    }
  }, [server.url, server.id, onUpdate]);

  // Auto-discover on mount for OAuth servers without config
  useEffect(() => {
    if (needsOAuthSetup && !discoveryRan.current) {
      discoveryRan.current = true;
      handleAutoDiscover();
    }
  }, [needsOAuthSetup, handleAutoDiscover]);

  const handleSaveOAuth = useCallback(async () => {
    if (!oauthForm.authorizeUrl || !oauthForm.clientId) return;
    setSavingOAuth(true);
    try {
      await fetch(`/api/mcp-servers/${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oauth_authorize_url: oauthForm.authorizeUrl,
          oauth_token_url: oauthForm.tokenUrl,
          oauth_client_id: oauthForm.clientId,
          oauth_client_secret: oauthForm.clientSecret || null,
        }),
      });
      onUpdate?.();
    } catch {
      // silent
    } finally {
      setSavingOAuth(false);
      setShowOAuthConfig(false);
    }
  }, [server.id, oauthForm, onUpdate]);

  const toolCount = server.discovered_tools?.length ?? 0;

  const handleDelete = async () => {
    if (!confirm(`Remove "${server.name}"? Granger will lose access to its ${toolCount} tools.`)) return;
    setDeleting(true);
    onDelete(server.id);
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 p-4">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? "Collapse tools" : "Expand tools"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Server info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm truncate">{server.name}</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
              {server.transport_type}
            </span>
            {server.auth_type && server.auth_type !== "bearer" && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                {server.auth_type}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{server.url}</p>
        </div>

        {/* Tool count badge */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Wrench className="h-3.5 w-3.5" />
          <span>{toolCount} tool{toolCount !== 1 ? "s" : ""}</span>
        </div>

        {/* Active toggle */}
        <button
          onClick={() => onToggle(server.id, !server.is_active)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            server.is_active ? "bg-primary" : "bg-muted"
          }`}
          role="switch"
          aria-checked={server.is_active}
          aria-label={`${server.is_active ? "Disable" : "Enable"} ${server.name}`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform ${
              server.is_active ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          aria-label={`Delete ${server.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Last connected */}
      {server.last_connected_at && (
        <div className="px-4 pb-2 -mt-1">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Last connected {new Date(server.last_connected_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Error message */}
      {server.error_message && (
        <div className="px-4 pb-2">
          <p className="text-[11px] text-destructive">{server.error_message}</p>
        </div>
      )}

      {/* OAuth connect button for OAuth servers without tokens */}
      {server.auth_type === "oauth" && !server.last_connected_at && (
        <div className="px-4 pb-3">
          {/* Case 1: Already has saved config OR auto-discovery succeeded — show Connect button */}
          {(server.oauth_authorize_url && server.oauth_client_id) || autoDiscoveryDone ? (
            <button
              onClick={async () => {
                // Prefer form state (freshly discovered) over stale DB values
                const authorizeUrl = oauthForm.authorizeUrl || server.oauth_authorize_url;
                const clientId = oauthForm.clientId || server.oauth_client_id;
                const tokenUrl = oauthForm.tokenUrl || server.oauth_token_url;
                const clientSecret = oauthForm.clientSecret || server.oauth_client_secret || undefined;
                const callbackUrl = `${window.location.origin}/api/mcp/oauth/callback`;

                // Generate PKCE code_verifier and code_challenge
                const codeVerifier = generateCodeVerifier();
                const codeChallenge = await generateCodeChallenge(codeVerifier);

                const stateObj = {
                  serverId: server.id,
                  tokenUrl,
                  clientId,
                  clientSecret,
                  codeVerifier,
                };
                const state = btoa(JSON.stringify(stateObj))
                  .replace(/\+/g, "-")
                  .replace(/\//g, "_")
                  .replace(/=+$/, "");
                const params = new URLSearchParams({
                  response_type: "code",
                  client_id: clientId!,
                  redirect_uri: callbackUrl,
                  state,
                  code_challenge: codeChallenge,
                  code_challenge_method: "S256",
                });
                window.location.href = `${authorizeUrl}?${params}`;
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <KeyRound className="h-3 w-3" />
              Connect with OAuth
            </button>
          ) : discovering ? (
            /* Case 2: Auto-discovery in progress */
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Discovering OAuth configuration...</span>
            </div>
          ) : (
            /* Case 3: Auto-discovery failed or hasn't run — show manual form */
            <div className="space-y-2">
              {!showOAuthConfig ? (
                <button
                  onClick={() => setShowOAuthConfig(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-primary text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/10 transition-colors"
                >
                  <KeyRound className="h-3 w-3" />
                  {autoDiscoveryFailed ? "Configure OAuth Manually" : "Configure OAuth to Connect"}
                </button>
              ) : (
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">OAuth Configuration</span>
                    <button
                      onClick={handleAutoDiscover}
                      disabled={discovering}
                      className="text-[11px] text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
                    >
                      {discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                      Auto-discover
                    </button>
                  </div>
                  <input
                    type="url"
                    placeholder="Authorize URL"
                    value={oauthForm.authorizeUrl}
                    onChange={(e) => setOauthForm((f) => ({ ...f, authorizeUrl: e.target.value }))}
                    className="w-full rounded border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="url"
                    placeholder="Token URL"
                    value={oauthForm.tokenUrl}
                    onChange={(e) => setOauthForm((f) => ({ ...f, tokenUrl: e.target.value }))}
                    className="w-full rounded border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    placeholder="Client ID"
                    value={oauthForm.clientId}
                    onChange={(e) => setOauthForm((f) => ({ ...f, clientId: e.target.value }))}
                    className="w-full rounded border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="password"
                    placeholder="Client Secret (optional)"
                    value={oauthForm.clientSecret}
                    onChange={(e) => setOauthForm((f) => ({ ...f, clientSecret: e.target.value }))}
                    className="w-full rounded border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveOAuth}
                      disabled={!oauthForm.authorizeUrl || !oauthForm.clientId || savingOAuth}
                      className="inline-flex items-center gap-1.5 rounded bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {savingOAuth ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
                      Save & Connect
                    </button>
                    <button
                      onClick={() => setShowOAuthConfig(false)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded tools list */}
      {expanded && toolCount > 0 && (
        <div className="border-t px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Discovered Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {server.discovered_tools.map((tool) => (
              <span
                key={tool.name}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-mono"
              >
                <Wrench className="h-3 w-3" />
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
