import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("context_items")
    .select(
      "id, title, description_short, description_long, source_type, source_id, content_type, raw_content, entities, status, ingested_at, processed_at, user_tags, last_viewed_at, view_count, is_pinned, is_archived",
    )
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  const { error } = await supabase
    .from("context_items")
    .delete()
    .eq("id", id)
    .eq("org_id", member.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.raw_content === "string") updates.raw_content = body.raw_content;
  if (typeof body.user_title === "string") updates.user_title = body.user_title;
  if (Array.isArray(body.user_tags)) updates.user_tags = body.user_tags;
  if (typeof body.last_viewed_at === "string") updates.last_viewed_at = body.last_viewed_at;
  if (typeof body.view_count === "number") updates.view_count = body.view_count;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // --- Document versioning: snapshot current state before updating ---
  if (updates.raw_content !== undefined || updates.title !== undefined) {
    const { data: current } = await supabase
      .from("context_items")
      .select("title, raw_content")
      .eq("id", id)
      .eq("org_id", member.org_id)
      .single();

    if (current) {
      const { data: latestVersion } = await supabase
        .from("document_versions")
        .select("version_number")
        .eq("context_item_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      const nextVersion = (latestVersion?.version_number ?? 0) + 1;

      await supabase.from("document_versions").insert({
        context_item_id: id,
        version_number: nextVersion,
        title: current.title,
        content: current.raw_content ?? "",
        edited_by: user.id,
        change_summary: body.change_summary ?? `Version ${nextVersion} before edit`,
      });
    }
  }

  const { data, error } = await supabase
    .from("context_items")
    .update(updates)
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select("id, title, raw_content, user_title, user_tags")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
