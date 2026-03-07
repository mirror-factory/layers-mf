import { createClient } from "@/lib/supabase/server";
import { ContextUploader } from "@/components/context-uploader";
import { ContextLibrary } from "@/components/context-library";
import { FileText } from "lucide-react";

export default async function ContextPage() {
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
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
          <h1 className="text-2xl font-semibold mb-1">Context Library</h1>
          <p className="text-muted-foreground text-sm">
            All documents, transcripts, and files available to your agents.
          </p>
        </div>
        <ContextUploader />
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
