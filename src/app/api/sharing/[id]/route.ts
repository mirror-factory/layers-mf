import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from: (table: string) => any };

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

const patchSchema = z.object({
  permission: z.enum(["viewer", "editor", "owner"]),
});

// --- DELETE: remove a content share by id (only if shared_by = current user) ---

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const adminDb = createAdminClient() as unknown as AnyDb;

  // Verify the share exists and belongs to the user
  const { data: share, error: fetchError } = await adminDb
    .from("content_shares")
    .select("id, shared_by")
    .eq("id", id)
    .single();

  if (fetchError || !share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  if (share.shared_by !== user.id) {
    return NextResponse.json({ error: "Only the share creator can remove it" }, { status: 403 });
  }

  const { error } = await adminDb
    .from("content_shares")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}

// --- PATCH: update permission level on a content share ---

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const adminDb = createAdminClient() as unknown as AnyDb;

  // Verify the share exists and belongs to the user
  const { data: share, error: fetchError } = await adminDb
    .from("content_shares")
    .select("id, shared_by")
    .eq("id", id)
    .single();

  if (fetchError || !share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  if (share.shared_by !== user.id) {
    return NextResponse.json({ error: "Only the share creator can update it" }, { status: 403 });
  }

  const { data, error } = await adminDb
    .from("content_shares")
    .update({ permission: parsed.data.permission })
    .eq("id", id)
    .select("id, content_id, content_type, shared_by, shared_with, permission, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  return NextResponse.json({ share: data });
}
