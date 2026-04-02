export const metadata = { title: "Artifacts" };

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileCode2,
  FileText,
  Box,
  Search,
  ArrowRight,
  Hash,
  DollarSign,
  GitBranch,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageExplainer } from "@/components/page-explainer";

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  code: { label: "Code", icon: FileCode2, color: "text-blue-500 bg-blue-500/10" },
  document: { label: "Document", icon: FileText, color: "text-purple-500 bg-purple-500/10" },
  sandbox: { label: "Sandbox", icon: Box, color: "text-green-500 bg-green-500/10" },
};

interface ArtifactsPageProps {
  searchParams: Promise<{ type?: string; q?: string }>;
}

export default async function ArtifactsPage({ searchParams }: ArtifactsPageProps) {
  const params = await searchParams;
  const activeType = params.type ?? "all";
  const searchQuery = params.q ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return null;

  // Build query against the artifacts table
  let query = (supabase as any)
    .from("artifacts")
    .select("id, type, title, language, framework, current_version, description_oneliner, description_short, tags, total_cost_usd, status, created_at, updated_at")
    .eq("org_id", member.org_id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (activeType !== "all") {
    query = query.eq("type", activeType);
  }

  if (searchQuery) {
    query = query.ilike("title", `%${searchQuery}%`);
  }

  const { data: artifacts } = await query;
  const items: any[] = artifacts ?? [];

  // Get counts for all types (unfiltered) for the tabs
  const { data: allArtifacts } = await (supabase as any)
    .from("artifacts")
    .select("type")
    .eq("org_id", member.org_id);

  const allItems: any[] = allArtifacts ?? [];
  const typeCounts = allItems.reduce<Record<string, number>>((acc, item) => {
    const t = item.type ?? "unknown";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const totalCount = allItems.length;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Artifacts</h1>
          <p className="text-muted-foreground text-sm">
            Code, documents, and sandboxes created during conversations.
          </p>
        </div>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors mt-2 sm:mt-0"
        >
          Create in Chat <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <PageExplainer
        title="How Artifacts Work"
        sections={[
          { title: "What are artifacts", content: "Code files, documents, sandboxes, and other outputs created by Granger during chat conversations. Each artifact is versioned and stored with full history." },
          { title: "Creating artifacts", content: "Ask Granger to write code, create documents, or build projects. Artifacts appear in the chat's artifact panel and are saved here automatically." },
          { title: "Versioning", content: "Every edit creates a new version. You can browse version history and restore previous versions at any time." },
        ]}
      />

      {/* Search input */}
      <form className="my-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Search artifacts..."
            defaultValue={searchQuery}
            className="pl-9"
          />
          {activeType !== "all" && (
            <input type="hidden" name="type" value={activeType} />
          )}
        </div>
      </form>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-2 my-4">
        <Link href="/artifacts">
          <Badge variant={activeType === "all" ? "default" : "outline"} className="cursor-pointer">
            All {totalCount}
          </Badge>
        </Link>
        {(["code", "document", "sandbox"] as const).map((type) => {
          const meta = TYPE_META[type];
          const count = typeCounts[type] ?? 0;
          const params = new URLSearchParams();
          params.set("type", type);
          if (searchQuery) params.set("q", searchQuery);
          return (
            <Link key={type} href={`/artifacts?${params.toString()}`}>
              <Badge
                variant={activeType === type ? "default" : "outline"}
                className="cursor-pointer"
              >
                {meta.label} {count}
              </Badge>
            </Link>
          );
        })}
      </div>

      {/* Artifacts grid */}
      {items.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center">
            <FileCode2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-medium mb-1">No artifacts yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Start a conversation and ask Granger to write code, create documents, or build projects. Artifacts will appear here.
            </p>
            <Link
              href="/chat"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start a Chat
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any) => {
            const meta = TYPE_META[item.type] ?? {
              label: item.type,
              icon: FileText,
              color: "text-muted-foreground bg-muted",
            };
            const Icon = meta.icon;
            const tags: string[] = item.tags ?? [];
            const cost = item.total_cost_usd ?? 0;

            return (
              <Link key={item.id} href={`/context/${item.id}`}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 shrink-0 ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        {item.description_oneliner && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.description_oneliner}
                          </p>
                        )}

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                <Hash className="h-2.5 w-2.5 mr-0.5" />
                                {tag}
                              </Badge>
                            ))}
                            {tags.length > 3 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                +{tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Meta row: type, version, cost, time */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {meta.label}
                          </Badge>
                          {item.current_version > 1 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <GitBranch className="h-2.5 w-2.5" />
                              v{item.current_version}
                            </span>
                          )}
                          {cost > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <DollarSign className="h-2.5 w-2.5" />
                              {cost < 0.01 ? "<0.01" : cost.toFixed(2)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(item.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
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
