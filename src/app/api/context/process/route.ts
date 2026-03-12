import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contextItemId } = body;
  if (!contextItemId || typeof contextItemId !== "string") {
    return NextResponse.json(
      { error: "Missing required field: contextItemId" },
      { status: 400 }
    );
  }

  // Emit Inngest event for durable processing
  await inngest.send({
    name: "context/item.created",
    data: { contextItemId, orgId: member.org_id },
  });

  return NextResponse.json(
    { contextItemId, status: "accepted" },
    { status: 202 }
  );
}
