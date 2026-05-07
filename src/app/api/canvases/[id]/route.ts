import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

const updateCanvasSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number().min(0.1).max(10),
    })
    .optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: canvas, error } = await (supabase as any)
    .from("canvases")
    .select("id, name, description, viewport, settings, created_by, created_at, updated_at")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (error || !canvas) {
    return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase as any)
    .from("canvas_items")
    .select("id, context_item_id, x, y, width, height, color, style, item_type, content, created_at, updated_at")
    .eq("canvas_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connections } = await (supabase as any)
    .from("canvas_connections")
    .select("id, from_item_id, to_item_id, label, style, created_at")
    .eq("canvas_id", id);

  return NextResponse.json({
    ...canvas,
    items: items ?? [],
    connections: connections ?? [],
  });
}

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
  const parsed = updateCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: canvas, error } = await (supabase as any)
    .from("canvases")
    .update({
      ...parsed.data,
      viewport: parsed.data.viewport as unknown as Json,
      settings: parsed.data.settings as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select("id, name, description, viewport, settings, updated_at")
    .single();

  if (error || !canvas) {
    return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
  }

  return NextResponse.json(canvas);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("canvases")
    .delete()
    .eq("id", id)
    .eq("org_id", member.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
