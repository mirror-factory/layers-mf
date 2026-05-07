import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUILTIN_SKILLS } from "@/lib/skills/types";

export async function POST() {
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

  const rows = BUILTIN_SKILLS.map((skill) => ({
    org_id: member.org_id,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    author: skill.author ?? null,
    category: skill.category,
    icon: skill.icon,
    system_prompt: skill.systemPrompt ?? null,
    tools: skill.tools ?? [],
    config: skill.config ?? {},
    slash_command: skill.slashCommand ?? null,
    is_active: true,
    is_builtin: true,
  }));

  // Upsert: insert or update on conflict (org_id, slug)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("skills")
    .upsert(rows, { onConflict: "org_id,slug" })
    .select("id, slug, name");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    seeded: data?.length ?? 0,
    skills: data ?? [],
  });
}
