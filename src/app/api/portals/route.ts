import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portals, error } = await (supabase as any)
    .from("document_portals")
    .select(
      "id, title, subtitle, client_name, brand_color, share_token, is_public, view_count, last_viewed_at, created_at, updated_at, model, enabled_tools, context_item_id"
    )
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ portals });
}

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
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title as string;
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // If context_item_id provided, load document_content from it
  let documentContent = body.document_content as string | undefined;
  if (!documentContent && body.context_item_id) {
    const { data: contextItem } = await supabase
      .from("context_items")
      .select("raw_content")
      .eq("id", body.context_item_id as string)
      .eq("org_id", member.org_id)
      .single();
    if (contextItem?.raw_content) {
      documentContent = contextItem.raw_content;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portal, error } = await (supabase as any)
    .from("document_portals")
    .insert({
      org_id: member.org_id,
      created_by: user.id,
      title,
      subtitle: (body.subtitle as string) ?? null,
      client_name: (body.client_name as string) ?? null,
      context_item_id: (body.context_item_id as string) ?? null,
      pdf_storage_path: (body.pdf_storage_path as string) ?? null,
      document_content: documentContent ?? null,
      brand_color: (body.brand_color as string) ?? "#34d399",
      brand_secondary_color: (body.brand_secondary_color as string) ?? null,
      logo_url: (body.logo_url as string) ?? null,
      audio_storage_path: (body.audio_storage_path as string) ?? null,
      system_prompt: (body.system_prompt as string) ?? null,
      enabled_tools: (body.enabled_tools as string[]) ?? [
        "search_document",
        "navigate_pdf",
        "render_chart",
        "web_search",
      ],
      model: (body.model as string) ?? "google/gemini-3-flash",
      hide_chrome: (body.hide_chrome as boolean) ?? false,
      default_expanded: (body.default_expanded as boolean) ?? false,
      is_public: (body.is_public as boolean) ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ portal }, { status: 201 });
}
