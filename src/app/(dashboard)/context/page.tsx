export const metadata = { title: "Context Library" };
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContextLibrary } from "@/components/context-library";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ContextPage(props: {
  searchParams?: Promise<{ search?: string }>;
}) {
  const searchParams = await props.searchParams;
  const initialSearch = searchParams?.search ?? "";
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
        .select("id, title, description_short, source_type, content_type, status, ingested_at, user_tags")
        .eq("org_id", member.org_id)
        .order("ingested_at", { ascending: false })
        .limit(200)
    : { data: [] };

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

      <ContextLibrary items={items ?? []} initialSearch={initialSearch} />
    </div>
  );
}
