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
    .select("user_title, user_notes, user_tags, trust_weight")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    user_title: item.user_title ?? null,
    user_notes: item.user_notes ?? null,
    user_tags: item.user_tags ?? [],
    trust_weight: item.trust_weight ?? 1.0,
  });
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

  // Verify item belongs to same org
  const { data: existing } = await supabase
    .from("context_items")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate and build update payload
  const update: Record<string, unknown> = {};
  const errors: string[] = [];

  if ("user_title" in body) {
    if (body.user_title !== null && typeof body.user_title !== "string") {
      errors.push("user_title must be a string or null");
    } else if (typeof body.user_title === "string" && body.user_title.length > 200) {
      errors.push("user_title must be at most 200 characters");
    } else {
      update.user_title = body.user_title;
    }
  }

  if ("user_notes" in body) {
    if (body.user_notes !== null && typeof body.user_notes !== "string") {
      errors.push("user_notes must be a string or null");
    } else if (typeof body.user_notes === "string" && body.user_notes.length > 2000) {
      errors.push("user_notes must be at most 2000 characters");
    } else {
      update.user_notes = body.user_notes;
    }
  }

  if ("user_tags" in body) {
    if (!Array.isArray(body.user_tags)) {
      errors.push("user_tags must be an array");
    } else if (body.user_tags.length > 20) {
      errors.push("user_tags must have at most 20 tags");
    } else if (!body.user_tags.every((t: unknown) => typeof t === "string" && t.length <= 50)) {
      errors.push("Each tag must be a string of at most 50 characters");
    } else {
      update.user_tags = body.user_tags;
    }
  }

  if ("trust_weight" in body) {
    if (typeof body.trust_weight !== "number" || body.trust_weight < 0.1 || body.trust_weight > 2.0) {
      errors.push("trust_weight must be a number between 0.1 and 2.0");
    } else {
      update.trust_weight = body.trust_weight;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("context_items")
    .update(update)
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select("user_title, user_notes, user_tags, trust_weight")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update annotations" }, { status: 500 });
  }

  return NextResponse.json({
    user_title: updated.user_title ?? null,
    user_notes: updated.user_notes ?? null,
    user_tags: updated.user_tags ?? [],
    trust_weight: updated.trust_weight ?? 1.0,
  });
}
