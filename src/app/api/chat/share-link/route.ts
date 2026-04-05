import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/chat/share-link — Create a public share link for a conversation
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await request.json();
  const conversationId = body.conversationId as string;
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Check if share already exists
  const { data: existing } = await sb
    .from("public_chat_shares")
    .select("id, share_token, is_active")
    .eq("conversation_id", conversationId)
    .eq("shared_by", user.id)
    .single();

  if (existing) {
    if (!existing.is_active) {
      await sb.from("public_chat_shares").update({ is_active: true }).eq("id", existing.id);
    }
    return NextResponse.json({
      shareToken: existing.share_token,
      shareUrl: `/share/${existing.share_token}`,
    });
  }

  const { data: share, error } = await sb
    .from("public_chat_shares")
    .insert({
      conversation_id: conversationId,
      org_id: member.org_id,
      shared_by: user.id,
      allow_org_view: true,
      allow_public_view: true,
    })
    .select("share_token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    shareToken: share.share_token,
    shareUrl: `/share/${share.share_token}`,
  });
}

/**
 * DELETE /api/chat/share-link — Deactivate a share link
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("public_chat_shares")
    .update({ is_active: false })
    .eq("conversation_id", body.conversationId)
    .eq("shared_by", user.id);

  return NextResponse.json({ deactivated: true });
}
