import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

async function getOwnerContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" as const, status: 401 };

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) return { error: "No organization found" as const, status: 400 };
  if (member.role !== "owner") return { error: "Forbidden" as const, status: 403 };

  return { user, member, supabase };
}

export async function GET() {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return new Response(ctx.error, { status: ctx.status });

  const { data: invitations, error } = await ctx.supabase
    .from("org_invitations")
    .select("id, email, role, status, created_at, expires_at")
    .eq("org_id", ctx.member.org_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(invitations);
}

export async function POST(request: NextRequest) {
  const ctx = await getOwnerContext();
  if ("error" in ctx) return new Response(ctx.error, { status: ctx.status });

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  // Cannot invite yourself
  if (email === ctx.user.email) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  // Check if already a member
  const admin = createAdminClient();
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find((u) => u.email === email);

  if (existingUser) {
    const { data: existingMember } = await ctx.supabase
      .from("org_members")
      .select("id")
      .eq("org_id", ctx.member.org_id)
      .eq("user_id", existingUser.id)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 409 }
      );
    }
  }

  // Upsert invitation (reset status if previously revoked/expired)
  const { data: invitation, error: inviteError } = await admin
    .from("org_invitations")
    .upsert(
      {
        org_id: ctx.member.org_id,
        email,
        role,
        invited_by: ctx.user.id,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "org_id,email" }
    )
    .select("id, email, role, status, created_at, expires_at")
    .single();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  // Send magic link via Supabase Auth
  await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
  });

  return NextResponse.json(invitation, { status: 201 });
}
