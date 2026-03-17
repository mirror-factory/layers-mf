import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  HardDrive,
  Github,
  Upload,
  Hash,
  GitBranch,
  Mic,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextAnnotations } from "@/components/context-annotations";
import { ContextVersionHistory } from "@/components/context-version-history";
import { EntityChips } from "@/components/entity-chips";

const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "google-drive": { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  gdrive:         { label: "Google Drive", icon: HardDrive, color: "text-blue-500" },
  github:         { label: "GitHub",       icon: Github,    color: "text-slate-600" },
  "github-app":   { label: "GitHub",       icon: Github,    color: "text-slate-600" },
  slack:          { label: "Slack",        icon: Hash,      color: "text-purple-500" },
  granola:        { label: "Granola",      icon: Mic,       color: "text-orange-500" },
  linear:         { label: "Linear",       icon: GitBranch, color: "text-indigo-500" },
  upload:         { label: "Uploads",      icon: Upload,    color: "text-green-600" },
};

interface Entities {
  people?: string[];
  topics?: string[];
  action_items?: string[];
  decisions?: string[];
  projects?: string[];
  dates?: string[];
}

export default async function ContextDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user!.id)
    .single();

  if (!member) notFound();

  const [{ data: item }, { count: versionCount }] = await Promise.all([
    supabase
      .from("context_items")
      .select(
        "id, title, description_short, description_long, source_type, content_type, raw_content, entities, status, ingested_at, processed_at, user_title, user_notes, user_tags, trust_weight",
      )
      .eq("id", id)
      .eq("org_id", member.org_id)
      .single(),
    supabase
      .from("context_item_versions")
      .select("id", { count: "exact", head: true })
      .eq("context_item_id", id)
      .eq("org_id", member.org_id),
  ]);

  if (!item) notFound();

  const source = SOURCE_META[item.source_type] ?? {
    label: item.source_type,
    icon: FileText,
    color: "text-muted-foreground",
  };
  const SourceIcon = source.icon;
  const entities = (item.entities ?? {}) as Entities;
  const hasEntities =
    (entities.people?.length ?? 0) > 0 ||
    (entities.topics?.length ?? 0) > 0 ||
    (entities.action_items?.length ?? 0) > 0 ||
    (entities.decisions?.length ?? 0) > 0 ||
    (entities.projects?.length ?? 0) > 0 ||
    (entities.dates?.length ?? 0) > 0;

  return (
    <div data-testid="context-detail-page" className="flex flex-col p-4 sm:p-8 gap-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/context"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Context Library
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1.5">
            <SourceIcon className={`h-3 w-3 ${source.color}`} />
            {source.label}
          </Badge>
          <Badge variant="outline">
            {item.content_type.replace(/_/g, " ")}
          </Badge>
          <Badge
            variant={item.status === "ready" ? "default" : item.status === "error" ? "destructive" : "secondary"}
          >
            {item.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <h1 data-testid="context-detail-title" className="text-2xl font-semibold">
            {item.user_title ?? item.title}
          </h1>
          {(versionCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-xs">
              {versionCount} {versionCount === 1 ? "version" : "versions"}
            </Badge>
          )}
        </div>
        {item.user_title && (
          <p className="text-sm text-muted-foreground">Original: {item.title}</p>
        )}
        {item.description_short && (
          <p className="text-muted-foreground">{item.description_short}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Ingested {new Date(item.ingested_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          {item.processed_at && (
            <span>Processed {new Date(item.processed_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>
      </div>

      {/* Description long */}
      {item.description_long && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description_long}</p>
          </CardContent>
        </Card>
      )}

      {/* Entities */}
      {hasEntities && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Extracted Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityChips entities={entities} />
          </CardContent>
        </Card>
      )}

      {/* Raw content */}
      {item.raw_content && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {item.raw_content}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Annotations */}
      <ContextAnnotations
        itemId={item.id}
        userTitle={item.user_title ?? null}
        userNotes={item.user_notes ?? null}
        userTags={item.user_tags ?? []}
        trustWeight={item.trust_weight ?? 1.0}
        aiTitle={item.title}
      />

      {/* Version History */}
      <ContextVersionHistory
        itemId={item.id}
        versionCount={versionCount ?? 0}
      />
    </div>
  );
}

