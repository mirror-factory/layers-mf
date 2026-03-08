import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((d) => d.displayName !== undefined || d.password !== undefined, {
    message: "At least one field (displayName or password) is required",
  });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name ?? "",
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) {
    updates.data = { display_name: parsed.data.displayName };
  }
  if (parsed.data.password !== undefined) {
    updates.password = parsed.data.password;
  }

  const { error } = await supabase.auth.updateUser(updates);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
