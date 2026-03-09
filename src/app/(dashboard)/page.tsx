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

  // Fetch stats and recent items in parallel
  const [contextResult, contextCount, sessionsResult, sessionsCount, integrationsResult] =
    await Promise.all([
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
        .from("sessions")
        .select("id, name, status, updated_at")
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),
      supabase
        .from("context_items")
        .select("source_type")
        .eq("org_id", orgId)
        .not("source_type", "eq", "upload"),
    ]);

  const recentItems = contextResult.data ?? [];
  const recentSessions = sessionsResult.data ?? [];
  const totalDocs = contextCount.count ?? 0;
  const totalSessions = sessionsCount.count ?? 0;

  // Count unique integration source types
  const integrationTypes = new Set(
    (integrationsResult.data ?? []).map((i) => i.source_type),
  );
  const totalIntegrations = integrationTypes.size;

  const displayName =
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {displayName}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s what&apos;s happening in your knowledge base.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Documents"
          value={totalDocs}
          icon={FileText}
          href="/context"
        />
        <StatCard
          title="Sessions"
          value={totalSessions}
          icon={FolderKanban}
          href="/sessions"
        />
        <StatCard
          title="Integrations"
          value={totalIntegrations}
          icon={Plug}
          href="/integrations"
        />
      </div>

      {/* Recent items */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent context items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Documents</CardTitle>
            <Link
              href="/context"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              <div className="space-y-3">
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
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition-colors"
                    >
                      <SourceIcon className={`h-4 w-4 shrink-0 ${source.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.content_type.replace(/_/g, " ")} · {new Date(item.ingested_at).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Sessions</CardTitle>
            <Link
              href="/sessions"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition-colors"
                  >
                    <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.status} · {new Date(session.updated_at).toLocaleDateString()}
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
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/30 transition-colors cursor-pointer">
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="rounded-md bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
