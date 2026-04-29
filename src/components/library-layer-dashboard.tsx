import type { ElementType } from "react";
import Link from "next/link";
import {
  Archive,
  Bot,
  Boxes,
  CheckCircle2,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  Image,
  Inbox,
  KeyRound,
  Network,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LibraryLayerIntakeActions } from "@/components/library-layer-intake-actions";
import { cn } from "@/lib/utils";

type RecentItem = {
  id: string;
  title: string;
  source_type: string | null;
  content_type: string | null;
  library_item_type?: string | null;
  status: string | null;
  ingested_at: string | null;
};

type Stack = {
  id: string;
  name: string;
  description: string | null;
  is_smart?: boolean | null;
};

type McpServer = {
  id: string;
  name: string;
  is_active: boolean | null;
  health_status?: string | null;
  oauth_status?: string | null;
  discovered_tools?: { name: string }[] | null;
  tool_snapshot?: { name: string }[] | null;
};

type ContextPack = {
  id: string;
  name: string;
  purpose: string | null;
  visibility: string;
  created_at: string;
};

type SyncRule = {
  id: string;
  name: string;
  is_active: boolean;
  cadence: string | null;
  item_type: string | null;
};

type InboxItem = {
  id: string;
  title: string;
  type: string | null;
  priority: string | null;
  source_type: string | null;
  created_at: string | null;
};

type DeweyProfile = {
  name: string;
  tone: string;
  saveBehavior: string;
  approvalPolicy: string;
  allowedTools: string[];
};

interface LibraryLayerDashboardProps {
  counts: {
    items: number;
    stacks: number;
    inbox: number;
    assets: number;
    contextPacks: number;
    mcpServers: number;
    syncRules: number;
    approvals: number;
  };
  recentItems: RecentItem[];
  stacks: Stack[];
  mcpServers: McpServer[];
  contextPacks: ContextPack[];
  syncRules: SyncRule[];
  inboxItems: InboxItem[];
  dewey: DeweyProfile;
}

const fmt = new Intl.NumberFormat("en-US");

function timeLabel(date: string | null) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function HealthDot({ status }: { status?: string | null }) {
  const normalized = status ?? "unknown";
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        normalized === "healthy" || normalized === "connected"
          ? "bg-emerald-500"
          : normalized === "error" || normalized === "failed"
            ? "bg-red-500"
            : "bg-amber-500",
      )}
    />
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ElementType;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{fmt.format(value)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LibraryLayerDashboard({
  counts,
  recentItems,
  stacks,
  mcpServers,
  contextPacks,
  syncRules,
  inboxItems,
  dewey,
}: LibraryLayerDashboardProps) {
  const healthyServers = mcpServers.filter((server) => {
    const health = server.health_status ?? (server.is_active ? "healthy" : "unknown");
    return health === "healthy" || health === "connected";
  }).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-20 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Database className="h-3 w-3" />
              Library Layer
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Bot className="h-3 w-3" />
              {dewey.name}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Library</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {dewey.tone} · {dewey.saveBehavior.replaceAll("_", " ")} · {dewey.approvalPolicy.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/context/upload-meeting">
              <Upload className="h-4 w-4" />
              Upload
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/mcp">
              <Network className="h-4 w-4" />
              MCPs
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/chat">
              <Sparkles className="h-4 w-4" />
              Ask Dewey
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Library metrics">
        <Stat label="Library Items" value={counts.items} icon={FileText} />
        <Stat label="Stacks" value={counts.stacks} icon={FolderOpen} />
        <Stat label="Inbox" value={counts.inbox} icon={Inbox} />
        <Stat label="Assets" value={counts.assets} icon={Image} />
        <Stat label="Context Packs" value={counts.contextPacks} icon={PackageCheck} />
        <Stat label="MCP Servers" value={counts.mcpServers} icon={Network} />
        <Stat label="Sync Rules" value={counts.syncRules} icon={GitBranch} />
        <Stat label="Approvals" value={counts.approvals} icon={ShieldCheck} />
      </section>

      <LibraryLayerIntakeActions
        stacks={stacks.map((stack) => ({ id: stack.id, name: stack.name }))}
        inboxItems={inboxItems}
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Archive className="h-4 w-4" />
                Recent Items
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/context">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {recentItems.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No Library Items yet.</div>
              ) : (
                recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/context/${item.id}`}
                    className="grid gap-2 p-4 transition-colors hover:bg-muted/50 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.source_type ?? "manual"} · {item.library_item_type ?? item.content_type ?? "document"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <Badge variant={item.status === "ready" ? "secondary" : "outline"}>
                        {item.status ?? "unknown"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeLabel(item.ingested_at)}</span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" />
                MCP Connections
              </CardTitle>
              <Badge variant="outline">{healthyServers}/{mcpServers.length} healthy</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {mcpServers.length === 0 ? (
                <div className="md:col-span-2 text-sm text-muted-foreground">No MCP servers connected.</div>
              ) : (
                mcpServers.map((server) => {
                  const toolCount = server.tool_snapshot?.length ?? server.discovered_tools?.length ?? 0;
                  return (
                    <div key={server.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <HealthDot status={server.health_status ?? (server.is_active ? "healthy" : "unknown")} />
                          <p className="truncate text-sm font-medium">{server.name}</p>
                        </div>
                        <Badge variant="outline">{toolCount} tools</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{server.oauth_status ?? "oauth unknown"}</span>
                        <span>·</span>
                        <span>{server.health_status ?? (server.is_active ? "active" : "inactive")}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" />
                Dewey
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Allowed Tools</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dewey.allowedTools.slice(0, 8).map((tool) => (
                    <Badge key={tool} variant="secondary">
                      {tool.replaceAll("_", " ")}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <Link className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted/50" href="/approvals">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Approval Queue
                </Link>
                <Link className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted/50" href="/chat">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Chat With Dewey
                </Link>
                <Link className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted/50" href="/sandbox">
                  <Terminal className="h-4 w-4 text-primary" />
                  Sandbox Work
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageCheck className="h-4 w-4" />
                Context Packs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contextPacks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No context packs yet.</p>
              ) : (
                contextPacks.map((pack) => (
                  <div key={pack.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{pack.name}</p>
                      <Badge variant="outline">{pack.visibility}</Badge>
                    </div>
                    {pack.purpose && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pack.purpose}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4" />
                Sync Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {syncRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sync rules yet.</p>
              ) : (
                syncRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">{rule.item_type ?? "item"} · {rule.cadence ?? "manual"}</p>
                    </div>
                    {rule.is_active ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <KeyRound className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-4 w-4" />
                Stacks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stacks.slice(0, 8).map((stack) => (
                <div key={stack.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="truncate text-sm">{stack.name}</span>
                  {stack.is_smart && <Badge variant="outline">smart</Badge>}
                </div>
              ))}
              {stacks.length === 0 && <p className="text-sm text-muted-foreground">No Stacks yet.</p>}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
