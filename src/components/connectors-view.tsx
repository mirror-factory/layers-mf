"use client";

import { useState } from "react";
import {
  Plug,
  Server,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NeuralDots } from "@/components/ui/neural-dots";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  provider: string;
  nango_connection_id: string;
  status: string;
  last_sync_at: string | null;
}

interface MCPServer {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  last_connected_at: string | null;
  error_message: string | null;
  discovered_tools: { name: string }[];
}

const PROVIDER_META: Record<
  string,
  { label: string; icon: string; description: string }
> = {
  granola: {
    label: "Granola",
    icon: "🌾",
    description: "Meeting transcripts and notes",
  },
  linear: {
    label: "Linear",
    icon: "📐",
    description: "Issues, projects, and cycles",
  },
  "google-drive": {
    label: "Google Drive",
    icon: "📁",
    description: "Documents and files",
  },
  github: {
    label: "GitHub",
    icon: "🐙",
    description: "Repositories and issues",
  },
  "github-app": {
    label: "GitHub",
    icon: "🐙",
    description: "Repositories and issues",
  },
  slack: {
    label: "Slack",
    icon: "💬",
    description: "Messages and channels",
  },
};

type ConnectorStatus = "connected" | "disconnected" | "error" | "connecting";

interface ConnectorCardProps {
  id: string;
  name: string;
  icon: string;
  status: ConnectorStatus;
  type: "API" | "MCP";
  lastSync: string | null;
  description?: string;
  errorMessage?: string | null;
  toolCount?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  connecting?: boolean;
}

function ConnectorCard({
  name,
  icon,
  status,
  type,
  lastSync,
  description,
  errorMessage,
  toolCount,
  onConnect,
  onDisconnect,
  connecting,
}: ConnectorCardProps) {
  const [readAccess, setReadAccess] = useState(status === "connected");
  const [writeAccess, setWriteAccess] = useState(false);

  const statusConfig: Record<
    ConnectorStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
  > = {
    connected: {
      label: "Connected",
      variant: "default",
      icon: <Wifi className="h-3 w-3" />,
    },
    disconnected: {
      label: "Disconnected",
      variant: "secondary",
      icon: <WifiOff className="h-3 w-3" />,
    },
    error: {
      label: "Error",
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    },
    connecting: {
      label: "Connecting",
      variant: "outline",
      icon: null,
    },
  };

  const currentStatus = connecting ? "connecting" : status;
  const config = statusConfig[currentStatus];

  return (
    <Card className="relative overflow-hidden">
      {connecting && (
        <div className="absolute top-2 right-2">
          <NeuralDots size={32} dotCount={8} active={true} />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <CardTitle className="text-sm font-medium">{name}</CardTitle>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} className="text-[10px] gap-1">
              {currentStatus === "connecting" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                config.icon
              )}
              {config.label}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {type}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Last sync / tool count info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {lastSync
              ? `Last sync: ${new Date(lastSync).toLocaleDateString()}`
              : "Never synced"}
          </span>
          {toolCount !== undefined && toolCount > 0 && (
            <span>
              {toolCount} tool{toolCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Error message */}
        {errorMessage && status === "error" && (
          <p className="text-xs text-destructive">{errorMessage}</p>
        )}

        {/* Permission toggles (Task 6.2) */}
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={readAccess}
              onCheckedChange={setReadAccess}
              className="scale-75"
            />
            <span className="text-muted-foreground">Read access</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={writeAccess}
              onCheckedChange={setWriteAccess}
              className="scale-75"
            />
            <span className="text-muted-foreground">Write access</span>
          </label>
        </div>

        {/* Connect / Disconnect button */}
        <div className="pt-1">
          {status === "connected" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              className="w-full text-xs h-8"
            >
              <WifiOff className="h-3 w-3 mr-1.5" />
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onConnect}
              disabled={connecting}
              className="w-full text-xs h-8"
            >
              {connecting ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Plug className="h-3 w-3 mr-1.5" />
              )}
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ConnectorsViewProps {
  integrations: Integration[];
  mcpServers: MCPServer[];
}

export function ConnectorsView({
  integrations,
  mcpServers,
}: ConnectorsViewProps) {
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleConnectIntegration = async () => {
    // Opens Nango connect UI — same logic as IntegrationsConnect
    setConnectingId("nango");
    try {
      const res = await fetch("/api/integrations/connect-session", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to create connect session");
      const { sessionToken } = await res.json();

      const { default: Nango } = await import("@nangohq/frontend");
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: async (event) => {
          if (event.type === "close") {
            setConnectingId(null);
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = event as any;
          const connectionId: string =
            e.connectionId ??
            e.payload?.connectionId ??
            e.connection?.connectionId ??
            "";
          const provider: string =
            e.providerConfigKey ??
            e.payload?.providerConfigKey ??
            e.connection?.providerConfigKey ??
            "";
          if (connectionId && provider) {
            try {
              await fetch("/api/integrations/save-connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ connectionId, provider }),
              });
            } catch {
              // silent
            }
            setConnectingId(null);
            window.location.reload();
          } else {
            setConnectingId(null);
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } catch {
      setConnectingId(null);
    }
  };

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
    setConnectingId(id);
    try {
      await fetch(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      window.location.reload();
    } catch {
      setConnectingId(null);
    }
  };

  const totalConnectors = integrations.length + mcpServers.length;
  const connectedCount =
    integrations.filter((i) => i.status === "connected").length +
    mcpServers.filter((s) => s.is_active && !s.error_message).length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Plug className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">Connectors</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage all your integrations and MCP servers in one place.
          {totalConnectors > 0 && (
            <span className="ml-1">
              {connectedCount} of {totalConnectors} connected.
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <Button onClick={handleConnectIntegration} disabled={connectingId === "nango"}>
          {connectingId === "nango" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plug className="h-4 w-4 mr-2" />
          )}
          {connectingId === "nango" ? "Connecting..." : "Add Integration"}
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Grid */}
      {totalConnectors === 0 ? (
        <div className="text-center py-16">
          <Plug className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">
            No connectors configured yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Add an integration or MCP server to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* API Integrations */}
          {integrations.map((integration) => {
            const meta = PROVIDER_META[integration.provider];
            const integrationStatus: ConnectorStatus =
              integration.status === "connected"
                ? "connected"
                : integration.status === "error"
                  ? "error"
                  : "disconnected";

            return (
              <ConnectorCard
                key={integration.id}
                id={integration.id}
                name={meta?.label ?? integration.provider}
                icon={meta?.icon ?? "🔌"}
                description={meta?.description}
                status={integrationStatus}
                type="API"
                lastSync={integration.last_sync_at}
                onConnect={handleConnectIntegration}
                connecting={connectingId === "nango"}
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
                id={server.id}
                name={server.name}
                icon="🔧"
                status={mcpStatus}
                type="MCP"
                lastSync={server.last_connected_at}
                errorMessage={server.error_message}
                toolCount={server.discovered_tools?.length ?? 0}
                onConnect={() => handleReconnectMCP(server.id)}
                onDisconnect={() => handleDisconnectMCP(server.id)}
                connecting={connectingId === server.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
