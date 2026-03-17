export const metadata = { title: "Sessions" };

import { createClient } from "@/lib/supabase/server";
import { SessionsList } from "@/components/sessions-list";
import { CreateSessionDialog } from "@/components/create-session-dialog";
import { FolderKanban } from "lucide-react";

export default async function SessionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user!.id)
    .single();

  const { data: sessions } = member
    ? await supabase
        .from("sessions")
        .select("id, name, goal, status, updated_at, last_agent_run")
        .eq("org_id", member.org_id)
        .order("updated_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-4 sm:gap-6 min-h-screen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 data-testid="sessions-page-heading" className="text-xl sm:text-2xl font-semibold mb-1">Sessions</h1>
          <p className="text-muted-foreground text-sm">
            Focused workspaces with scoped context and chat.
          </p>
        </div>
        <CreateSessionDialog />
      </div>

      {!sessions || sessions.length === 0 ? (
        <div data-testid="sessions-empty-state" className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <FolderKanban className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm font-medium text-foreground">No sessions yet</p>
          <p className="text-xs mt-1 max-w-xs text-center">
            Sessions let you scope AI conversations to specific documents and topics.
          </p>
          <div className="mt-4">
            <CreateSessionDialog />
          </div>
        </div>
      ) : (
        <SessionsList sessions={sessions} />
      )}
    </div>
  );
}
