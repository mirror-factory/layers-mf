import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]),
});

const removeMemberSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) return new Response("No organization found", { status: 400 });

  // Get all org members
  const { data: members, error } = await supabase
    .from("org_members")
    .select("id, user_id, role")
    .eq("org_id", member.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with email from auth.users via admin client
  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const userMap = new Map(
    authUsers?.users.map((u) => [u.id, u.email]) ?? []
  );

  const enriched = (members ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    email: userMap.get(m.user_id) ?? "unknown",
    role: m.role,
  }));

  return NextResponse.json(enriched);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) return new Response("No organization found", { status: 400 });
  if (member.role !== "owner") return new Response("Forbidden", { status: 403 });

  const body = await request.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.userId === user.id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("org_members")
    .update({ role: parsed.data.role })
    .eq("org_id", member.org_id)
    .eq("user_id", parsed.data.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) return new Response("No organization found", { status: 400 });
  if (member.role !== "owner") return new Response("Forbidden", { status: 403 });

  const body = await request.json();
  const parsed = removeMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.userId === user.id) {
    return NextResponse.json(
      { error: "Cannot remove yourself" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("org_members")
    .delete()
    .eq("org_id", member.org_id)
    .eq("user_id", parsed.data.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
