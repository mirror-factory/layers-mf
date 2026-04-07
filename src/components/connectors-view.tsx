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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { NeuralDots } from "@/components/ui/neural-dots";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  { label: string; icon: React.ElementType; description: string }
> = {
  granola: {
    label: "Granola",
    icon: Mic,
    description: "Meeting transcripts and notes",
  },
  linear: {
    label: "Linear",
    icon: GitBranch,
    description: "Issues, projects, and cycles",
  },
  "google-drive": {
    label: "Google Drive",
    icon: HardDrive,
    description: "Documents and files",
  },
  github: {
    label: "GitHub",
    icon: Github,
    description: "Repositories and issues",
  },
  "github-app": {
    label: "GitHub",
    icon: Github,
    description: "Repositories and issues",
  },
  slack: {
    label: "Slack",
    icon: Hash,
    description: "Messages and channels",
  },
  gmail: {
    label: "Gmail",
    icon: Mail,
    description: "Email threads and messages",
  },
  notion: {
    label: "Notion",
    icon: StickyNote,
    description: "Pages, databases, and wiki content",
  },
  "layers-ai": {
    label: "Layers AI",
    icon: Bot,
    description: "Built-in AI assistant tools",
  },
  upload: {
    label: "Upload",
    icon: Upload,
    description: "Uploaded files and documents",
  },
};

type ConnectorStatus = "connected" | "disconnected" | "error" | "connecting";

interface ConnectorCardProps {
  id: string;
  name: string;
  icon: React.ElementType;
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
  icon: Icon,
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
            <Icon className="h-5 w-5 text-muted-foreground" />
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

/* ------------------------------------------------------------------ */
/*  Nango provider catalog for the Add Integration dialog              */
/* ------------------------------------------------------------------ */

const NANGO_PROVIDERS = [
  { id: "google-drive", label: "Google Drive", icon: HardDrive, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10", description: "Documents, spreadsheets, and files" },
  { id: "github", label: "GitHub", icon: Github, color: "text-gray-900 dark:text-gray-100", bgColor: "bg-gray-500/10", description: "Repositories and issues" },
  { id: "slack", label: "Slack", icon: Hash, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/10", description: "Messages and channels" },
  { id: "linear", label: "Linear", icon: BarChart3, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-500/10", description: "Issues, projects, and cycles" },
  { id: "gmail", label: "Gmail", icon: Mail, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500/10", description: "Email threads and messages" },
  { id: "notion", label: "Notion", icon: StickyNote, color: "text-stone-700 dark:text-stone-300", bgColor: "bg-stone-500/10", description: "Pages, databases, and wiki content" },
] as const;

/* ------------------------------------------------------------------ */
/*  Add Integration Dialog                                             */
/* ------------------------------------------------------------------ */

function AddIntegrationDialog({
  open,
  onOpenChange,
  connectedProviders,
  onConnectNango,
  connectingNango,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedProviders: Set<string>;
  onConnectNango: () => void;
  connectingNango: boolean;
}) {
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);

  const handleAddMCP = async () => {
    if (!mcpName.trim() || !mcpUrl.trim()) return;
    setMcpSaving(true);
    setMcpError(null);
    try {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mcpName.trim(), url: mcpUrl.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to add MCP server" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setMcpName("");
      setMcpUrl("");
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : "Failed to add MCP server");
    } finally {
      setMcpSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Integration</DialogTitle>
          <DialogDescription>
            Connect an OAuth integration or add an MCP server.
          </DialogDescription>
        </DialogHeader>

        {/* Nango OAuth integrations */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">OAuth Integrations</h3>
          <p className="text-xs text-muted-foreground">
            Connect via Nango to sync documents, issues, and messages automatically.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {NANGO_PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              const isConnected = connectedProviders.has(provider.id) ||
                (provider.id === "github" && connectedProviders.has("github-app"));
              return (
                <button
                  key={provider.id}
                  onClick={() => {
                    onConnectNango();
                  }}
                  disabled={connectingNango}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isConnected && "border-emerald-500/30 bg-emerald-500/5"
                  )}
                >
                  <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg shrink-0", provider.bgColor)}>
                    <Icon className={cn("h-4 w-4", provider.color)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{provider.label}</span>
                      {isConnected && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{provider.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {connectingNango && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Opening Nango connect window...
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* MCP Server */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            MCP Server
          </h3>
          <p className="text-xs text-muted-foreground">
            Add an MCP (Model Context Protocol) server to give your AI direct tool access.
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Server name"
              value={mcpName}
              onChange={(e) => setMcpName(e.target.value)}
            />
            <Input
              placeholder="https://mcp.example.com/sse"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
            />
          </div>
          {mcpError && (
            <p className="text-xs text-destructive">{mcpError}</p>
          )}
          <Button
            onClick={handleAddMCP}
            disabled={mcpSaving || !mcpName.trim() || !mcpUrl.trim()}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {mcpSaving ? (
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            ) : (
              <Server className="h-3 w-3 mr-2" />
            )}
            {mcpSaving ? "Adding..." : "Add MCP Server"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  ConnectorsView                                                     */
/* ------------------------------------------------------------------ */

interface ConnectorsViewProps {
  integrations: Integration[];
  mcpServers: MCPServer[];
}

export function ConnectorsView({
  integrations,
  mcpServers,
}: ConnectorsViewProps) {
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const connectedProviders = new Set(
    integrations
      .filter((i) => i.status === "active" || i.status === "connected")
      .map((i) => i.provider)
  );

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
            setDialogOpen(false);
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
    integrations.filter((i) => i.status === "active" || i.status === "connected").length +
    mcpServers.filter((s) => s.is_active && !s.error_message).length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Add Integration Dialog */}
      <AddIntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connectedProviders={connectedProviders}
        onConnectNango={handleConnectIntegration}
        connectingNango={connectingId === "nango"}
      />

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
        <Button onClick={() => setDialogOpen(true)}>
          <Plug className="h-4 w-4 mr-2" />
          Add Integration
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
              integration.status === "active" || integration.status === "connected"
                ? "connected"
                : integration.status === "error"
                  ? "error"
                  : "disconnected";

            return (
              <ConnectorCard
                key={integration.id}
                id={integration.id}
                name={meta?.label ?? integration.provider}
                icon={meta?.icon ?? Plug}
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
                icon={Server}
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
