import { createClient } from "@/lib/supabase/server";
import { SessionsList } from "@/components/sessions-list";
import { CreateSessionDialog } from "@/components/create-session-dialog";
import { FolderKanban } from "lucide-react";

export default async function SessionsPage() {
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
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
    <div className="flex flex-col p-8 gap-6 min-h-screen">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Sessions</h1>
          <p className="text-muted-foreground text-sm">
            Focused workspaces with scoped context and chat.
          </p>
        </div>
        <CreateSessionDialog />
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <FolderKanban className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No sessions yet. Create your first one above.</p>
        </div>
      ) : (
        <SessionsList sessions={sessions} />
      )}
    </div>
  );
}
