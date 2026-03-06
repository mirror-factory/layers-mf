import { createClient } from "@/lib/supabase/server";
import { ContextUploader } from "@/components/context-uploader";
import { FileText, Clock, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  ready: { label: "Ready", icon: CheckCircle, className: "text-green-600" },
  processing: { label: "Processing", icon: Loader, className: "text-blue-500" },
  pending: { label: "Pending", icon: Clock, className: "text-muted-foreground" },
  error: { label: "Error", icon: AlertCircle, className: "text-destructive" },
} as const;

const SOURCE_LABELS: Record<string, string> = {
  upload: "Upload",
  granola: "Granola",
  linear: "Linear",
  discord: "Discord",
  gdrive: "Google Drive",
};

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
        .limit(100)
    : { data: [] };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Context Library</h1>
        <p className="text-muted-foreground text-sm">
          All documents, transcripts, and files available to your agents.
        </p>
      </div>

      {/* Upload */}
      <div className="mb-8">
        <ContextUploader />
      </div>

      {/* Items list */}
      {!items || items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No context items yet. Upload your first document above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">{items.length} item{items.length !== 1 ? "s" : ""}</p>
          {items.map((item) => {
            const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            return (
              <div
                key={item.id}
                className="flex items-start gap-4 rounded-lg border p-4 bg-card hover:bg-accent/30 transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.description_short && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description_short}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">
                      {SOURCE_LABELS[item.source_type] ?? item.source_type}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {item.content_type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.ingested_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className={cn("flex items-center gap-1 text-xs shrink-0", status.className)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
