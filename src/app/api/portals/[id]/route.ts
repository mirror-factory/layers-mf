import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const { data: portal, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("document_portals")
    .select("*")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (error || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  return NextResponse.json({ portal });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Allowlist of updatable fields
  const allowedFields = [
    "title",
    "subtitle",
    "client_name",
    "context_item_id",
    "pdf_storage_path",
    "document_content",
    "brand_color",
    "brand_secondary_color",
    "logo_url",
    "audio_storage_path",
    "system_prompt",
    "enabled_tools",
    "model",
    "hide_chrome",
    "default_expanded",
    "is_public",
    "password_hash",
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const { data: portal, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("document_portals")
    .update(updates)
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select()
    .single();

  if (error || !portal) {
    return NextResponse.json({ error: "Portal not found or update failed" }, { status: 404 });
  }

  return NextResponse.json({ portal });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const { error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("document_portals")
    .delete()
    .eq("id", id)
    .eq("org_id", member.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
