import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
});

const deleteSchema = z.object({
  confirm: z.literal("DELETE"),
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

  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, created_at")
    .eq("id", member.org_id)
    .single();

  if (!org) return new Response("Organization not found", { status: 404 });

  // Gather stats
  const [memberCount, contextItemCount, integrationCount] = await Promise.all([
    supabase
      .from("org_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", member.org_id)
      .then((r) => r.count ?? 0),
    supabase
      .from("context_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", member.org_id)
      .then((r) => r.count ?? 0),
    supabase
      .from("integrations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", member.org_id)
      .then((r) => r.count ?? 0),
  ]);

  return NextResponse.json({
    id: org.id,
    name: org.name,
    created_at: org.created_at,
    member_count: memberCount,
    context_item_count: contextItemCount,
    integration_count: integrationCount,
  });
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

  if (member.role !== "owner") {
    return NextResponse.json({ error: "Only owners can update the organization" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq("id", member.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  if (member.role !== "owner") {
    return NextResponse.json({ error: "Only owners can delete the organization" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "You must include { \"confirm\": \"DELETE\" } to delete the organization" },
      { status: 400 }
    );
  }

  // CASCADE delete all org data
  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", member.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
