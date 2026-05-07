import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { vote } = body;

  if (!vote || !["approve", "reject"].includes(vote)) {
    return NextResponse.json({ error: "Invalid vote. Must be 'approve' or 'reject'" }, { status: 400 });
  }

  // Fetch the proposal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal, error: fetchError } = await (supabase as any)
    .from("edit_proposals")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();

  if (fetchError || !proposal) {
    return NextResponse.json(
      { error: "Proposal not found or already resolved" },
      { status: 404 },
    );
  }

  // Prevent proposer from voting on their own proposal
  if (proposal.proposed_by === user.id) {
    return NextResponse.json(
      { error: "You cannot vote on your own proposal" },
      { status: 403 },
    );
  }

  // Check if user already voted
  const existingApprovals = (proposal.approvals ?? []) as Array<{
    user_id: string;
    approved: boolean;
    timestamp: string;
  }>;
  const alreadyVoted = existingApprovals.some((a) => a.user_id === user.id);
  if (alreadyVoted) {
    return NextResponse.json({ error: "You have already voted on this proposal" }, { status: 409 });
  }

  // Add vote
  const newVote = {
    user_id: user.id,
    approved: vote === "approve",
    timestamp: new Date().toISOString(),
  };
  const updatedApprovals = [...existingApprovals, newVote];

  // Count approvals and rejections
  const approveCount = updatedApprovals.filter((a) => a.approved).length;
  const rejectCount = updatedApprovals.filter((a) => !a.approved).length;

  // Determine new status
  const requiredApprovals = proposal.required_approvals as number;
  // Rejection threshold: enough rejections that approval is impossible
  // e.g., with 3 members and required=2, if 2 reject it's blocked
  const requiredToBlock = requiredApprovals;

  let newStatus: "pending" | "approved" | "rejected" = "pending";
  if (approveCount >= requiredApprovals) {
    newStatus = "approved";
  } else if (rejectCount >= requiredToBlock) {
    newStatus = "rejected";
  }

  // Update proposal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (supabase as any)
    .from("edit_proposals")
    .update({
      approvals: updatedApprovals,
      status: newStatus,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If approved, apply the edit to the context item
  let applied = false;
  if (newStatus === "approved") {
    const updateFields: Record<string, unknown> = {
      raw_content: proposal.proposed_content,
    };
    if (proposal.proposed_title) {
      updateFields.title = proposal.proposed_title;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: applyError } = await (supabase as any)
      .from("context_items")
      .update(updateFields)
      .eq("id", proposal.context_item_id);

    if (applyError) {
      console.error("[edit-proposals] Failed to apply approved edit:", applyError.message);
    } else {
      applied = true;
    }
  }

  return NextResponse.json({
    proposal: updated,
    vote: newVote,
    applied,
    status: newStatus,
  });
}
