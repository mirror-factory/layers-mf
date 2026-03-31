import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const shareSchema = z.object({
  conversationId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1),
});

// Table not yet in generated types — use untyped client access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = ReturnType<Awaited<ReturnType<typeof createClient>>["from"]> extends infer R ? any : never;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { conversationId, userIds } = parsed.data;

  const rows = userIds.map((uid) => ({
    conversation_id: conversationId,
    shared_by: user.id,
    shared_with: uid,
  }));

  // shared_conversations table created by migration 20260330030000
  const { data, error } = await (supabase as unknown as { from: (table: string) => UntypedClient }).from("shared_conversations")
    .upsert(rows, { onConflict: "conversation_id,shared_with" })
    .select();

  if (error) {
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  return NextResponse.json({ shared: data });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as unknown as { from: (table: string) => UntypedClient }).from("shared_conversations")
    .select("shared_with")
    .eq("conversation_id", conversationId);

  if (error) {
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  const sharedWithIds = ((data as { shared_with: string }[]) ?? []).map((r) => r.shared_with);
  return NextResponse.json({ sharedWith: sharedWithIds });
}
