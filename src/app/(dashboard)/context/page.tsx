export const metadata = { title: "Context Library" };
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContextLibrary } from "@/components/context-library";
import { PageExplainer } from "@/components/page-explainer";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ContextPage(props: {
  searchParams?: Promise<{ search?: string }>;
}) {
  const searchParams = await props.searchParams;
  const initialSearch = searchParams?.search ?? "";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Use service client to bypass RLS for server-side data loading
  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminDb = createAdminClient();

  const { data: member, error: memberError } = await adminDb
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  // Debug removed — was: console.log("[context] user/member/error")

  const { data: items, error: itemsError } = member
    ? await adminDb
        .from("context_items")
        .select("id, title, description_short, source_type, content_type, status, ingested_at")
        .eq("org_id", member.org_id)
        .order("ingested_at", { ascending: false })
        .limit(200)
    : { data: [], error: null };

  // Debug removed

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-4 sm:gap-6 min-h-screen">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 data-testid="context-page-heading" className="text-xl sm:text-2xl font-semibold mb-1">Context Library</h1>
          <p className="text-muted-foreground text-sm">
            All documents, transcripts, and files available to your agents.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/context/upload-meeting">
            <Mic className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Upload Meeting</span>
            <span className="sm:hidden">Meeting</span>
          </Link>
        </Button>
      </div>

      <PageExplainer
        title="How the Context Library Works"
        sections={[
          { title: "What goes here", content: "Documents, meeting transcripts, code files, and messages from all connected integrations. Everything Granger can search when answering questions." },
          { title: "Hybrid search", content: "Search uses both vector embeddings (semantic meaning) and BM25 text matching, combined with Reciprocal Rank Fusion for best results." },
          { title: "Sources", content: "Items are synced automatically from Google Drive, GitHub, Slack, Linear, and Granola. You can also upload files manually (PDF, DOCX, TXT, MD, up to 10MB)." },
          { title: "Processing", content: "Uploaded documents are automatically processed: text extracted, embeddings generated, and entities identified. Status shows as 'Ready' when complete." },
        ]}
      />

      <ContextLibrary items={items ?? []} initialSearch={initialSearch} />
    </div>
  );
}
