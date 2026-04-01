export const metadata = { title: "Home" };

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  FolderKanban,
  Plug,
  ArrowRight,
  HardDrive,
  Github,
  Upload,
  Hash,
  GitBranch,
  Mic,
  MessageSquare,
  CheckCircle,
  Inbox,
  Clock,
  Calendar,
  Zap,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "google-drive": { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  github:         { label: "GitHub",       icon: Github,    color: "text-slate-600" },
  slack:          { label: "Slack",        icon: Hash,      color: "text-purple-500" },
  granola:        { label: "Granola",      icon: Mic,       color: "text-orange-500" },
  linear:         { label: "Linear",       icon: GitBranch, color: "text-indigo-500" },
  upload:         { label: "Uploads",      icon: Upload,    color: "text-green-600" },
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) redirect("/login");

  const orgId = member.org_id;

  // Fetch stats, recent items, conversations, and schedules in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [
    contextResult, contextCount, approvalsCount, inboxCount,
    integrationsResult, conversationsResult, schedulesResult,
  ] = await Promise.all([
    supabase
      .from("context_items")
      .select("id, title, source_type, content_type, ingested_at")
      .eq("org_id", orgId)
      .order("ingested_at", { ascending: false })
      .limit(5),
    supabase
      .from("context_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "pending"),
    db
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_read", false),
    supabase
      .from("context_items")
      .select("source_type")
      .eq("org_id", orgId)
      .not("source_type", "eq", "upload"),
    db
      .from("conversations")
      .select("id, title, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(5),
    db
      .from("schedules")
      .select("id, name, cron_expression, status, next_run_at")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("next_run_at", { ascending: true })
      .limit(3),
  ]);

  const recentItems = contextResult.data ?? [];
  const totalDocs = contextCount.count ?? 0;
  const pendingApprovals = approvalsCount.count ?? 0;
  const unreadInbox = inboxCount.count ?? 0;
  const recentConversations = conversationsResult.data ?? [];
  const activeSchedules = schedulesResult.data ?? [];

  const integrationTypes = new Set(
    (integrationsResult.data ?? []).map((i: { source_type: string }) => i.source_type),
  );
  const totalIntegrations = integrationTypes.size;

  const displayName =
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
    "there";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Hero greeting */}
      <div className="relative rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border p-6 sm:p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 text-primary/60 text-xs font-medium mb-2">
            <Zap className="h-3.5 w-3.5" />
            <span>Granger — AI Chief of Staff</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}, {displayName}</h1>
          <p className="text-muted-foreground mt-1.5 max-w-lg">
            {pendingApprovals > 0
              ? `You have ${pendingApprovals} pending approval${pendingApprovals > 1 ? "s" : ""} and ${totalDocs} documents in your knowledge base.`
              : `Your knowledge base has ${totalDocs} documents across ${totalIntegrations} source${totalIntegrations !== 1 ? "s" : ""}.`}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Chat with Granger
            </Link>
            <Link
              href="/context"
              className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <FileText className="h-4 w-4" />
              Browse Context
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard title="Pending Approvals" value={pendingApprovals} icon={CheckCircle} href="/approvals" highlight={pendingApprovals > 0} />
        <StatCard title="Unread Inbox" value={unreadInbox} icon={Inbox} href="/inbox" highlight={unreadInbox > 0} />
        <StatCard title="Context Items" value={totalDocs} icon={FileText} href="/context" />
        <StatCard title="Integrations" value={totalIntegrations} icon={Plug} href="/integrations" />
      </div>

      {/* Three-column grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent conversations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Conversations</CardTitle>
            <Link href="/chat" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentConversations.length === 0 ? (
              <div className="text-center py-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
                <Link href="/chat" className="text-xs text-primary hover:underline mt-1 inline-block">Start one</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentConversations.map((conv: { id: string; title: string | null; updated_at: string }) => (
                  <Link
                    key={conv.id}
                    href={`/chat?id=${conv.id}`}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{conv.title ?? "New conversation"}</p>
                      <p className="text-[10px] text-muted-foreground">{timeAgo(conv.updated_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Documents</CardTitle>
            <Link href="/context" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentItems.length === 0 ? (
              <div className="text-center py-4">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No documents yet.</p>
                <Link href="/context" className="text-xs text-primary hover:underline mt-1 inline-block">Upload one</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentItems.map((item) => {
                  const source = SOURCE_META[item.source_type] ?? {
                    label: item.source_type,
                    icon: FileText,
                    color: "text-muted-foreground",
                  };
                  const SourceIcon = source.icon;
                  return (
                    <Link
                      key={item.id}
                      href={`/context/${item.id}`}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition-colors"
                    >
                      <SourceIcon className={`h-3.5 w-3.5 shrink-0 ${source.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.content_type.replace(/_/g, " ")} · {timeAgo(item.ingested_at)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active schedules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
            <Link href="/schedules" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {activeSchedules.length === 0 ? (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active schedules.</p>
                <Link href="/schedules" className="text-xs text-primary hover:underline mt-1 inline-block">Create one</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activeSchedules.map((s: { id: string; name: string; cron_expression: string; next_run_at: string | null }) => (
                  <Link
                    key={s.id}
                    href="/schedules"
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.cron_expression}
                        {s.next_run_at && ` · next: ${new Date(s.next_run_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  highlight,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/30 transition-colors cursor-pointer">
        <CardContent className="flex items-center gap-3 pt-5 pb-4">
          <div className={`rounded-lg p-2 ${highlight ? "bg-destructive/10" : "bg-primary/10"}`}>
            <Icon className={`h-4 w-4 ${highlight ? "text-destructive" : "text-primary"}`} />
          </div>
          <div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{title}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
