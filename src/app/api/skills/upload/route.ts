import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 }
    );
  }

  // Read and parse JSON
  let parsed: Record<string, unknown>;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "File is not valid JSON" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!parsed.name || typeof parsed.name !== "string") {
    return NextResponse.json(
      { error: "Skill file must include a 'name' field" },
      { status: 400 }
    );
  }
  if (!parsed.description || typeof parsed.description !== "string") {
    return NextResponse.json(
      { error: "Skill file must include a 'description' field" },
      { status: 400 }
    );
  }

  const slug =
    (typeof parsed.slug === "string" && parsed.slug) ||
    (parsed.name as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("skills")
    .insert({
      org_id: member.org_id,
      slug,
      name: parsed.name,
      description: parsed.description,
      version: (parsed.version as string) ?? "1.0.0",
      author: (parsed.author as string) ?? null,
      category: (parsed.category as string) ?? "general",
      icon: (parsed.icon as string) ?? "📦",
      system_prompt: (parsed.systemPrompt as string) ?? null,
      tools: (parsed.tools as unknown[]) ?? [],
      config: (parsed.config as Record<string, unknown>) ?? {},
      reference_files: (parsed.referenceFiles as unknown[]) ?? [],
      slash_command: (parsed.slashCommand as string) ?? null,
      is_active: true,
      is_builtin: false,
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
