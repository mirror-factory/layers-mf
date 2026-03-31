"use client";

import { useState, useEffect, useCallback } from "react";
import { Plug, Loader2, CheckCircle2, XCircle, Plus, ExternalLink, KeyRound } from "lucide-react";
import { MCPServerCard } from "@/components/mcp-server-card";

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

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
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

      {/* Guide */}
      <div className="rounded-lg border bg-muted/30 p-4 mb-6 text-sm space-y-3">
        <p className="font-medium">Connect External Tools via MCP</p>
        <p className="text-muted-foreground">
          MCP (Model Context Protocol) lets you connect Granger to any compatible service.
          Just provide a URL and optional API key — Granger automatically discovers all available tools.
        </p>
        <div className="text-muted-foreground space-y-1">
          <p className="font-medium text-foreground text-xs uppercase tracking-wide">How it works</p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs">
            <li>Add a server URL (e.g., https://weather-mcp.io/mcp)</li>
            <li>Click &quot;Test Connection&quot; to discover tools</li>
            <li>Save the server — tools are immediately available to Granger</li>
            <li>Use the tools naturally in chat</li>
          </ol>
        </div>
        <a
          href="https://smithery.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Browse 2000+ MCP servers on Smithery
          <ExternalLink className="h-3 w-3" />
        </a>
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
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="h-4 w-4" />
                <span className="font-medium text-foreground text-xs">OAuth Authentication</span>
              </div>
              <p className="text-xs">
                Save the server first, then use the &quot;Connect with OAuth&quot; button
                on the server card to authorize access.
              </p>
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
            Save the server first, then use the &quot;Connect with OAuth&quot; button on the server card to complete authentication.
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
            />
          ))
        )}
      </div>
    </div>
  );
}
