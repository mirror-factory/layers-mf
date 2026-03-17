import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const VALID_FEEDBACK = new Set(["positive", "negative"]);
const VALID_REASONS = new Set([
  "wrong_answer",
  "wrong_source",
  "outdated",
  "missing_context",
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messageId, conversationId, feedback, reason } = body as {
    messageId?: string;
    conversationId?: string;
    feedback?: string;
    reason?: string;
  };

  if (!messageId || typeof messageId !== "string") {
    return NextResponse.json(
      { error: "messageId is required" },
      { status: 400 }
    );
  }

  if (!feedback || !VALID_FEEDBACK.has(feedback)) {
    return NextResponse.json(
      { error: "feedback must be 'positive' or 'negative'" },
      { status: 400 }
    );
  }

  if (reason && !VALID_REASONS.has(reason)) {
    return NextResponse.json(
      { error: "Invalid reason" },
      { status: 400 }
    );
  }

  const adminDb = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminDb as any)
    .from("audit_log")
    .insert({
      org_id: member.org_id,
      user_id: user.id,
      action: "chat_feedback",
      resource_type: "chat_message",
      resource_id: messageId,
      metadata: {
        feedback,
        reason: reason ?? null,
        conversationId: conversationId ?? null,
      },
    });

  return NextResponse.json({ success: true });
}
