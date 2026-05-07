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
  _supabase: Awaited<ReturnType<typeof createClient>>,
  _userId: string
) {
  const { target_service } = approval;

  // API client execution removed (moved to MCP-only integrations).
  // Approved actions are now handled by MCP tools directly.
  return { executed: false, reason: `Direct API execution for ${target_service} is no longer supported. Use MCP tools instead.` };
}
