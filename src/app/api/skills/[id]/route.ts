import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
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

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member)
    return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.systemPrompt === "string") updates.system_prompt = body.systemPrompt;
  if (typeof body.slashCommand === "string") updates.slash_command = body.slashCommand;
  if (typeof body.icon === "string") updates.icon = body.icon;
  if (typeof body.category === "string") updates.category = body.category;
  if (Array.isArray(body.tools)) updates.tools = body.tools;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("skills")
    .update(updates)
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });

  return NextResponse.json({ skill: data });
}

export async function DELETE(
  _request: NextRequest,
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

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member)
    return NextResponse.json({ error: "No organization" }, { status: 400 });

  // Only allow deleting custom (non-builtin) skills
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: skill } = await (supabase as any)
    .from("skills")
    .select("is_builtin")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!skill)
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  if (skill.is_builtin)
    return NextResponse.json(
      { error: "Cannot delete builtin skills. Deactivate instead." },
      { status: 403 }
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("skills")
    .delete()
    .eq("id", id)
    .eq("org_id", member.org_id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
