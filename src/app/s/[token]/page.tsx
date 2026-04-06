import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { NeuralDots } from "@/components/ui/neural-dots";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from: (table: string) => any };

export const metadata: Metadata = {
  title: "Shared Content -- Layers",
};

// --- Source type labels ---

const SOURCE_LABELS: Record<string, string> = {
  "google-drive": "Google Drive",
  gdrive: "Google Drive",
  github: "GitHub",
  "github-app": "GitHub",
  slack: "Slack",
  granola: "Granola",
  gmail: "Gmail",
  linear: "Linear",
  upload: "Upload",
  "layers-ai": "AI Generated",
};

// --- Language display names ---

const LANG_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  markdown: "Markdown",
  sql: "SQL",
  tsx: "TSX",
  jsx: "JSX",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const adminDb = createAdminClient() as unknown as AnyDb;

  // Look up the share token
  const { data: share } = await adminDb
    .from("public_content_shares")
    .select("resource_type, resource_id, org_id, is_active, allow_public_view, expires_at, created_at")
    .eq("share_token", token)
    .eq("is_active", true)
    .single();

  if (!share) notFound();

  // Check expiry
  if (share.expires_at && new Date(share.expires_at) < new Date()) notFound();

  // For org-only shares, verify the viewer is in the org
  if (!share.allow_public_view) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) notFound();
    const { data: member } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", share.org_id)
      .single();
    if (!member) notFound();
  }

  const resourceType = share.resource_type as string;
  const resourceId = share.resource_id as string;

  // --- Render by resource type ---

  if (resourceType === "context_item") {
    const { data: item } = await adminDb
      .from("context_items")
      .select("id, title, description_short, description_long, source_type, content_type, raw_content, ingested_at")
      .eq("id", resourceId)
      .single();
    if (!item) notFound();

    const sourceLabel = SOURCE_LABELS[item.source_type] ?? item.source_type;

    return (
      <SharedPageShell title={item.title} subtitle={sourceLabel} date={item.ingested_at}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{sourceLabel}</Badge>
            <Badge variant="outline">{(item.content_type ?? "document").replace(/_/g, " ")}</Badge>
          </div>

          {item.description_short && (
            <p className="text-sm text-muted-foreground">{item.description_short}</p>
          )}

          {item.description_long && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Summary</h3>
              <p className="text-sm leading-relaxed">{item.description_long}</p>
            </div>
          )}

          {item.raw_content && (
            <div className="rounded-lg border bg-muted/30 p-4 max-h-[600px] overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap break-words">
                {item.raw_content}
              </div>
            </div>
          )}
        </div>
      </SharedPageShell>
    );
  }

  if (resourceType === "artifact") {
    const { data: artifact } = await adminDb
      .from("artifacts")
      .select("id, title, description, artifact_type, content, language, current_version, created_at")
      .eq("id", resourceId)
      .single();
    if (!artifact) notFound();

    const { data: files } = await adminDb
      .from("artifact_files")
      .select("file_path, content, language")
      .eq("artifact_id", resourceId)
      .order("file_path", { ascending: true });

    const artifactFiles = (files ?? []) as { file_path: string; content: string; language: string | null }[];
    const langLabel = LANG_LABELS[artifact.language ?? ""] ?? artifact.language ?? "code";

    return (
      <SharedPageShell title={artifact.title} subtitle={`Artifact (v${artifact.current_version ?? 1})`} date={artifact.created_at}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{artifact.artifact_type ?? "code"}</Badge>
            {artifact.language && <Badge variant="outline">{langLabel}</Badge>}
          </div>

          {artifact.description && (
            <p className="text-sm text-muted-foreground">{artifact.description}</p>
          )}

          {/* File tree for multi-file artifacts */}
          {artifactFiles.length > 1 && (
            <div className="rounded-lg border bg-card p-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Files</h3>
              <ul className="space-y-1">
                {artifactFiles.map((f) => (
                  <li key={f.file_path} className="text-xs font-mono text-muted-foreground">
                    {f.file_path}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Render files or single content */}
          {artifactFiles.length > 0 ? (
            artifactFiles.map((f) => (
              <div key={f.file_path} className="space-y-1">
                <p className="text-xs font-mono text-muted-foreground px-1">{f.file_path}</p>
                <div className="rounded-lg border bg-muted/30 p-4 max-h-[500px] overflow-y-auto">
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono">
                    {f.content}
                  </pre>
                </div>
              </div>
            ))
          ) : artifact.content ? (
            <div className="rounded-lg border bg-muted/30 p-4 max-h-[600px] overflow-y-auto">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono">
                {artifact.content}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No content available for this artifact.
            </p>
          )}
        </div>
      </SharedPageShell>
    );
  }

  if (resourceType === "skill") {
    const { data: skill } = await adminDb
      .from("skills")
      .select("id, name, description, instructions, category, created_at")
      .eq("id", resourceId)
      .single();
    if (!skill) notFound();

    return (
      <SharedPageShell title={skill.name} subtitle="Skill" date={skill.created_at}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{skill.category ?? "general"}</Badge>
          </div>

          {skill.description && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
              <p className="text-sm leading-relaxed">{skill.description}</p>
            </div>
          )}

          {skill.instructions && (
            <div className="rounded-lg border bg-muted/30 p-4 max-h-[600px] overflow-y-auto">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Instructions</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap break-words">
                {skill.instructions}
              </div>
            </div>
          )}
        </div>
      </SharedPageShell>
    );
  }

  notFound();
}

// --- Shared page shell (header + footer) ---

function SharedPageShell({
  title,
  subtitle,
  date,
  children,
}: {
  title: string;
  subtitle: string;
  date: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <NeuralDots size={28} dotCount={8} active={false} />
          <div>
            <h1 className="text-sm font-medium">{title}</h1>
            <p className="text-[10px] text-muted-foreground">
              Shared from Layers &middot; {subtitle} &middot; {formatDate(date)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="border-t bg-card/50 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <a href="/" className="text-primary font-medium hover:underline">
            Layers
          </a>{" "}
          &middot; AI OS for knowledge teams
        </p>
      </footer>
    </div>
  );
}
