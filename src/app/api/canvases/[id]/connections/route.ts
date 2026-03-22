import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createConnectionSchema = z.object({
  fromItemId: z.string().uuid(),
  toItemId: z.string().uuid(),
  label: z.string().max(200).optional(),
});

const deleteConnectionSchema = z.object({
  connectionId: z.string().uuid(),
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
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data: connection, error } = await supabase
    .from("canvas_connections")
    .insert({
      canvas_id: result.canvasId,
      from_item_id: parsed.data.fromItemId,
      to_item_id: parsed.data.toItemId,
      label: parsed.data.label ?? null,
    })
    .select("id, canvas_id, from_item_id, to_item_id, label, style, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(connection, { status: 201 });
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
  const parsed = deleteConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { error } = await supabase
    .from("canvas_connections")
    .delete()
    .eq("id", parsed.data.connectionId)
    .eq("canvas_id", result.canvasId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
