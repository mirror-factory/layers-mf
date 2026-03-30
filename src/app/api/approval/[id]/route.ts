import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const action = body.action;
  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("approval_queue")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { error: "Not found or already reviewed" },
      { status: 404 }
    );

  // If approved, execute the action
  let executionResult = null;
  if (newStatus === "approved") {
    executionResult = await executeApprovedAction(data, supabase, user.id);
  }

  return NextResponse.json({ item: data, execution: executionResult });
}

/**
 * Execute an approved action by calling the appropriate API.
 */
async function executeApprovedAction(
  approval: { action_type: string; target_service: string; payload: Record<string, unknown> },
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { action_type, target_service, payload } = approval;

  try {
    // Load credentials for this service
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member } = await (supabase as any)
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (!member) return { error: "No org found" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creds } = await (supabase as any)
      .from("credentials")
      .select("token_encrypted")
      .eq("org_id", member.org_id)
      .eq("provider", target_service)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .limit(1)
      .single();

    if (!creds) {
      return { error: `No ${target_service} credentials found. Add your API key in Settings.` };
    }

    switch (target_service) {
      case "linear": {
        if (action_type === "create_task") {
          const { LinearApiClient } = await import("@/lib/api/linear");
          const client = new LinearApiClient(creds.token_encrypted);
          // Need teamId — look up from team key
          const teams = await client.listTeams();
          const team = teams.find(t => t.key === payload.team || t.name === payload.team);
          if (!team) return { error: `Team "${payload.team}" not found in Linear` };
          const result = await client.createIssue({
            title: payload.title as string,
            teamId: team.id,
            description: payload.description as string | undefined,
            priority: payload.priority as number | undefined,
          });
          return { success: true, issue: result };
        }
        if (action_type === "update_task" || action_type === "update_issue") {
          const { LinearApiClient } = await import("@/lib/api/linear");
          const client = new LinearApiClient(creds.token_encrypted);
          const { id: issueId, ...updates } = payload;
          const result = await client.updateIssue(issueId as string, updates);
          return { success: true, ...result };
        }
        break;
      }
      case "gmail": {
        if (action_type === "draft_email") {
          const { GmailClient } = await import("@/lib/api/gmail");
          const client = new GmailClient(creds.token_encrypted);
          const result = await client.createDraft(
            payload.to as string,
            payload.subject as string,
            payload.body as string
          );
          return { success: true, draft: result };
        }
        break;
      }
      default:
        return { executed: false, reason: `Execution not implemented for ${target_service}` };
    }

    return { executed: false, reason: `Action type ${action_type} not implemented for ${target_service}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[approval] Execution failed:`, msg);
    return { error: msg };
  }
}
