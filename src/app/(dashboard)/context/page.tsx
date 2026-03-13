import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContextUploader } from "@/components/context-uploader";
import { ContextLibrary } from "@/components/context-library";
import { FileText, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ContextPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user!.id)
    .single();

  const { data: items } = member
    ? await supabase
        .from("context_items")
        .select("id, title, description_short, source_type, content_type, status, ingested_at")
        .eq("org_id", member.org_id)
        .order("ingested_at", { ascending: false })
        .limit(200)
    : { data: [] };

  return (
    <div className="flex flex-col p-8 gap-6 min-h-screen">
      <div className="flex items-start justify-between">
        <div>
          <h1 data-testid="context-page-heading" className="text-2xl font-semibold mb-1">Context Library</h1>
          <p className="text-muted-foreground text-sm">
            All documents, transcripts, and files available to your agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/context/upload-meeting">
              <Mic className="h-4 w-4 mr-1.5" />
              Upload Meeting
            </Link>
          </Button>
          <ContextUploader />
        </div>
      </div>

      {!items || items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <FileText className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No context items yet. Upload your first document above.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
          <ContextLibrary items={items} />
        </div>
      )}
    </div>
  );
}
