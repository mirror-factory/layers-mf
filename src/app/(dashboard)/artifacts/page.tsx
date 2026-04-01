export const metadata = { title: "Artifacts" };

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileCode2,
  FileText,
  Terminal,
  Globe,
  Image,
  Table2,
  ArrowRight,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageExplainer } from "@/components/page-explainer";

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  code: { label: "Code", icon: FileCode2, color: "text-blue-500 bg-blue-500/10" },
  document: { label: "Document", icon: FileText, color: "text-purple-500 bg-purple-500/10" },
  file: { label: "File", icon: Terminal, color: "text-green-500 bg-green-500/10" },
  html: { label: "HTML", icon: Globe, color: "text-orange-500 bg-orange-500/10" },
  image: { label: "Image", icon: Image, color: "text-pink-500 bg-pink-500/10" },
  csv: { label: "CSV", icon: Table2, color: "text-amber-500 bg-amber-500/10" },
};

export default async function ArtifactsPage() {
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

  // Fetch artifacts — context items that are code, documents, or files created by the AI
  const { data: artifacts } = await supabase
    .from("context_items")
    .select("id, title, source_type, content_type, status, ingested_at, description_short")
    .eq("org_id", member.org_id)
    .in("source_type", ["layers-ai", "upload"])
    .order("ingested_at", { ascending: false })
    .limit(100);

  const items = artifacts ?? [];

  // Group by content_type for filter counts
  const typeCounts = items.reduce<Record<string, number>>((acc, item) => {
    const t = item.content_type ?? "unknown";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Artifacts</h1>
          <p className="text-muted-foreground text-sm">
            Code, documents, and files created during conversations.
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
          { title: "What are artifacts", content: "Code files, documents, HTML pages, and other outputs created by Granger during chat conversations. Each artifact is versioned and stored in the context library." },
          { title: "Creating artifacts", content: "Ask Granger to write code, create documents, or build projects. Artifacts appear in the chat's artifact panel and are saved here automatically." },
          { title: "Types", content: "Code (JavaScript, Python, etc.), Documents (rich text via TipTap editor), HTML (live preview), Files (sandbox outputs), and more." },
        ]}
      />

      {/* Type filter badges */}
      <div className="flex flex-wrap gap-2 my-4">
        <Badge variant="default" className="cursor-default">
          All {items.length}
        </Badge>
        {Object.entries(typeCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([type, count]) => {
            const meta = TYPE_META[type];
            return (
              <Badge key={type} variant="outline" className="cursor-default">
                {meta?.label ?? type} {count}
              </Badge>
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
          {items.map((item) => {
            const meta = TYPE_META[item.content_type] ?? {
              label: item.content_type,
              icon: FileText,
              color: "text-muted-foreground bg-muted",
            };
            const Icon = meta.icon;
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
                        {item.description_short && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.description_short}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {meta.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(item.ingested_at)}
                          </span>
                          {item.status === "ready" && (
                            <span className="text-[10px] text-green-600">Ready</span>
                          )}
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
