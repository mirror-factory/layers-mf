"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronRight, Wrench, Globe, Zap, KeyRound } from "lucide-react";

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
}

export function MCPServerCard({
  server,
  onToggle,
  onDelete,
}: {
  server: MCPServer;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          <button
            onClick={() => {
              // Build OAuth authorization URL
              // The MCP server's auth endpoint is derived from the server URL
              const serverOrigin = new URL(server.url).origin;
              const authUrl = `${serverOrigin}/authorize`;
              const callbackUrl = `${window.location.origin}/api/mcp/oauth/callback`;
              const state = btoa(JSON.stringify({
                serverId: server.id,
                tokenUrl: `${serverOrigin}/token`,
                clientId: "granger",
              }));
              const params = new URLSearchParams({
                response_type: "code",
                client_id: "granger",
                redirect_uri: callbackUrl,
                state,
              });
              window.location.href = `${authUrl}?${params}`;
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <KeyRound className="h-3 w-3" />
            Connect with OAuth
          </button>
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
