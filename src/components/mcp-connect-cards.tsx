"use client";

import { useState } from "react";
import { Plug, Loader2, ExternalLink, Check, CheckCircle2 } from "lucide-react";

/** Inline OAuth connect card — triggers OAuth flow directly from chat */
export function MCPOAuthCard({ name, serverId, url }: { name: string; serverId: string; url: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setStatus("loading");
    try {
      // Discover OAuth metadata via server-side proxy
      const res = await fetch("/api/mcp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: url, appName: "Layers", callbackUrl: `${window.location.origin}/api/mcp/oauth/callback` }),
      });
      if (!res.ok) throw new Error("OAuth discovery failed");
      const meta = await res.json();
      const authorizeUrl = meta.authorizeUrl ?? "";
      const tokenUrl = meta.tokenUrl ?? "";
      const clientId = meta.clientId || window.location.origin;
      if (!authorizeUrl) throw new Error("No authorization endpoint found");

      // Save OAuth config to server record
      await fetch(`/api/mcp-servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oauth_authorize_url: authorizeUrl, oauth_token_url: tokenUrl, oauth_client_id: clientId }),
      });

      // Generate PKCE challenge
      const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const callbackUrl = `${window.location.origin}/api/mcp/oauth/callback`;
      const stateObj = { serverId, tokenUrl, clientId, codeVerifier: verifier, returnTo: window.location.pathname + window.location.search };
      const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const params = new URLSearchParams({
        response_type: "code", client_id: clientId, redirect_uri: callbackUrl,
        state, code_challenge: challenge, code_challenge_method: "S256",
      });
      window.location.href = `${authorizeUrl}?${params}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth failed");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 my-1 space-y-2">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">OAuth</span>
      </div>
      <p className="text-xs text-muted-foreground">Authorize {name} to connect its tools to your workspace.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        onClick={handleConnect}
        disabled={status === "loading"}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
        {status === "loading" ? "Connecting..." : "Connect with OAuth"}
      </button>
    </div>
  );
}

/** Inline bearer token card — API key input directly in chat */
export function MCPBearerCard({ name, serverId }: { name: string; serverId: string }) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/mcp-servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key_encrypted: apiKey.trim(), is_active: true, error_message: null }),
      });
      if (!res.ok) throw new Error("Failed to save API key");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm my-1">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>{name} connected — tools available next message</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3 my-1 space-y-2">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">API Key</span>
      </div>
      <p className="text-xs text-muted-foreground">Paste your API key or token to connect {name}.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-1.5">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="Paste API key or token..."
          className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || status === "saving"}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {status === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Connect
        </button>
      </div>
    </div>
  );
}
