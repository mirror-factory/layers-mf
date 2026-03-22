import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const addItemSchema = z.object({
  contextItemId: z.string().uuid().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  itemType: z.enum(["context", "note", "label", "group"]).default("context"),
  content: z.string().max(10000).optional(),
  color: z.string().max(50).optional(),
});

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: z.string().max(50).optional(),
  content: z.string().max(10000).optional(),
  style: z.record(z.unknown()).optional(),
});

const deleteItemSchema = z.object({
  itemId: z.string().uuid(),
});

async function getOrgAndCanvas(supabase: Awaited<ReturnType<typeof createClient>>, canvasId: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" as const };

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return { error: "No org" as const };

  // Verify canvas belongs to org
  const { data: canvas } = await supabase
    .from("canvases")
    .select("id")
    .eq("id", canvasId)
    .eq("org_id", member.org_id)
    .single();

  if (!canvas) return { error: "Canvas not found" as const };

  return { orgId: member.org_id, canvasId: canvas.id };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await getOrgAndCanvas(supabase, id);
  if ("error" in result) {
    if (result.error === "Unauthorized") return new Response("Unauthorized", { status: 401 });
    if (result.error === "No org") return new Response("No organization found", { status: 400 });
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const body = await request.json();
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("canvas_items")
    .insert({
      canvas_id: result.canvasId,
      context_item_id: parsed.data.contextItemId ?? null,
      x: parsed.data.x,
      y: parsed.data.y,
      width: parsed.data.width ?? 300,
      height: parsed.data.height ?? 200,
      item_type: parsed.data.itemType,
      content: parsed.data.content ?? null,
      color: parsed.data.color ?? null,
    })
    .select("id, canvas_id, context_item_id, x, y, width, height, color, style, item_type, content, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await getOrgAndCanvas(supabase, id);
  if ("error" in result) {
    if (result.error === "Unauthorized") return new Response("Unauthorized", { status: 401 });
    if (result.error === "No org") return new Response("No organization found", { status: 400 });
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { itemId, ...updates } = parsed.data;
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.x !== undefined) updateData.x = updates.x;
  if (updates.y !== undefined) updateData.y = updates.y;
  if (updates.width !== undefined) updateData.width = updates.width;
  if (updates.height !== undefined) updateData.height = updates.height;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.style !== undefined) updateData.style = updates.style;

  const { data: item, error } = await supabase
    .from("canvas_items")
    .update(updateData)
    .eq("id", itemId)
    .eq("canvas_id", result.canvasId)
    .select("id, x, y, width, height, color, style, content, updated_at")
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await getOrgAndCanvas(supabase, id);
  if ("error" in result) {
    if (result.error === "Unauthorized") return new Response("Unauthorized", { status: 401 });
    if (result.error === "No org") return new Response("No organization found", { status: 400 });
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const body = await request.json();
  const parsed = deleteItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await supabase
    .from("canvas_items")
    .delete()
    .eq("id", parsed.data.itemId)
    .eq("canvas_id", result.canvasId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
