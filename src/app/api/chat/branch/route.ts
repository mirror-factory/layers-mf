import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.conversationId !== "string" || typeof body.messageIndex !== "number") {
    return NextResponse.json({ error: "conversationId (string) and messageIndex (number) are required" }, { status: 400 });
  }

  const { conversationId, messageIndex } = body as { conversationId: string; messageIndex: number };

  // Verify the source conversation belongs to this org
  const { data: sourceConv } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("org_id", member.org_id)
    .single();

  if (!sourceConv) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Fetch messages for the source conversation (ordered by created_at ascending)
  const { data: sourceMessages, error: msgError } = await supabase
    .from("chat_messages")
    .select("role, content, model")
    .eq("conversation_id", conversationId)
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: true });

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  // Slice messages up to and including the specified index
  const messagesToCopy = (sourceMessages ?? []).slice(0, messageIndex + 1);

  if (messagesToCopy.length === 0) {
    return NextResponse.json({ error: "No messages to branch" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  // Create a new conversation
  // Use null title so auto-title kicks in after first response
  const branchTitle = sourceConv.title ? `${sourceConv.title} (branch)` : null;
  const { data: newConv, error: createError } = await adminDb
    .from("conversations")
    .insert({
      org_id: member.org_id,
      user_id: user.id,
      title: branchTitle,
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (createError || !newConv) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create conversation" }, { status: 500 });
  }

  // Copy messages into the new conversation
  const rows = messagesToCopy.map((msg) => ({
    org_id: member.org_id,
    user_id: user.id,
    session_id: null,
    conversation_id: newConv.id,
    role: msg.role,
    content: msg.content,
    model: msg.model,
  }));

  const { error: insertError } = await adminDb
    .from("chat_messages")
    .insert(rows);

  if (insertError) {
    // Clean up the conversation if message insert fails
    await adminDb.from("conversations").delete().eq("id", newConv.id);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Copy agent_runs for cost tracking continuity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sourceRuns } = await (adminDb as any)
    .from("agent_runs")
    .select("model, query, step_count, finish_reason, total_input_tokens, total_output_tokens, cache_read_tokens, cache_write_tokens, duration_ms, tool_calls, gateway_cost_usd, step_details")
    .eq("conversation_id", conversationId)
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: true });

  if (sourceRuns && sourceRuns.length > 0) {
    // Only copy runs up to the branch point (match assistant message count)
    const assistantCount = messagesToCopy.filter((m: { role: string }) => m.role === "assistant").length;
    const runsToCopy = sourceRuns.slice(0, assistantCount).map((run: Record<string, unknown>) => ({
      ...run,
      org_id: member.org_id,
      user_id: user.id,
      conversation_id: newConv.id,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminDb as any).from("agent_runs").insert(runsToCopy);
  }

  return NextResponse.json({ conversationId: newConv.id, title: branchTitle }, { status: 201 });
}
