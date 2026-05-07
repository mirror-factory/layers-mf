import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyContent } from "@/lib/ai/classify";

export async function POST(request: NextRequest) {
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

  let body: { id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json(
      { error: "Missing required field: id" },
      { status: 400 },
    );
  }

  // Fetch the context item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase as any)
    .from("context_items")
    .select("id, raw_content, content_type, title")
    .eq("id", body.id)
    .eq("org_id", member.org_id)
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Context item not found" }, { status: 404 });
  }

  if (!item.raw_content) {
    return NextResponse.json(
      { error: "Context item has no content to classify" },
      { status: 400 },
    );
  }

  try {
    const classification = await classifyContent(
      item.raw_content,
      item.content_type ?? "document",
    );

    // Update the context item with classification results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("context_items")
      .update({
        title: classification.title,
        description_short: classification.shortDesc,
        description_long: classification.longDesc,
        entities: {
          people: classification.entities.people,
          topics: classification.entities.topics,
          decisions: classification.entities.decisions,
          action_items: classification.entities.actionItems,
          tags: classification.tags,
          categories: classification.categories,
          language: classification.language,
          framework: classification.framework,
        },
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      console.error("[classify] Failed to update context item:", updateError);
      return NextResponse.json(
        { error: "Failed to update context item" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: item.id,
      classification,
    });
  } catch (err) {
    console.error("[classify] Classification failed:", err);
    return NextResponse.json(
      { error: "Classification failed" },
      { status: 500 },
    );
  }
}
