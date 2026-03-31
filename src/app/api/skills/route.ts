import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function toSnakeCase(skill: Record<string, unknown>) {
  return {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    version: skill.version ?? "1.0.0",
    author: skill.author ?? null,
    category: skill.category ?? "general",
    icon: skill.icon ?? "⚡",
    system_prompt: skill.systemPrompt ?? null,
    tools: skill.tools ?? [],
    config: skill.config ?? {},
    reference_files: skill.referenceFiles ?? [],
    slash_command: skill.slashCommand ?? null,
    is_active: skill.isActive ?? true,
    is_builtin: false,
  };
}

export async function GET() {
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

  // Use admin client to bypass RLS
  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminDb = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminDb as any)
    .from("skills")
    .select("*")
    .eq("org_id", member.org_id)
    .order("is_builtin", { ascending: false })
    .order("name", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-seed builtins if none exist
  if (!data || data.length === 0) {
    const { BUILTIN_SKILLS } = await import("@/lib/skills/types");
    const rows = BUILTIN_SKILLS.map(s => ({
      org_id: member.org_id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      version: s.version,
      author: s.author,
      category: s.category,
      icon: s.icon,
      system_prompt: s.systemPrompt,
      tools: s.tools,
      slash_command: s.slashCommand,
      is_active: true,
      is_builtin: true,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminDb as any).from("skills").upsert(rows, { onConflict: "org_id,slug" });
    // Re-fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: seeded } = await (adminDb as any)
      .from("skills")
      .select("*")
      .eq("org_id", member.org_id)
      .order("is_builtin", { ascending: false })
      .order("name", { ascending: true });
    return NextResponse.json({ skills: seeded ?? [] });
  }

  return NextResponse.json({ skills: data ?? [] });
}

export async function POST(request: NextRequest) {
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

  if (!body.name || !body.description) {
    return NextResponse.json(
      { error: "Name and description are required" },
      { status: 400 }
    );
  }

  const slug =
    body.slug ||
    body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const { createAdminClient: createAdmin } = await import("@/lib/supabase/server");
  const adminPost = createAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminPost as any)
    .from("skills")
    .insert({
      org_id: member.org_id,
      ...toSnakeCase({ ...body, slug }),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Skill with slug "${slug}" already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ skill: data }, { status: 201 });
}
