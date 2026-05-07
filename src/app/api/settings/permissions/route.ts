import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ServicePermission = { read: boolean; write: boolean };

export type ToolPermissions = {
  linear?: ServicePermission;
  gmail?: ServicePermission;
  notion?: ServicePermission;
  granola?: ServicePermission;
  drive?: ServicePermission;
  approvals?: { auto_approve: string[] };
};

const VALID_SERVICES = ["linear", "gmail", "notion", "granola", "drive"] as const;

/**
 * GET /api/settings/permissions
 * Load tool_permissions for the authenticated user.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("partner_settings")
    .select("tool_permissions")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return stored permissions or defaults (all services: read=true, write=false)
  const stored: ToolPermissions = data?.tool_permissions ?? {};
  const permissions: ToolPermissions = {};

  for (const svc of VALID_SERVICES) {
    permissions[svc] = {
      read: stored[svc]?.read ?? true,
      write: stored[svc]?.write ?? false,
    };
  }

  return NextResponse.json({ permissions });
}

/**
 * POST /api/settings/permissions
 * Save tool_permissions for the authenticated user.
 * Body: { permissions: ToolPermissions }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { permissions?: ToolPermissions };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.permissions || typeof body.permissions !== "object") {
    return NextResponse.json({ error: "Missing permissions object" }, { status: 400 });
  }

  // Validate and sanitize — only allow known services with boolean read/write
  const sanitized: ToolPermissions = {};
  for (const svc of VALID_SERVICES) {
    const perm = body.permissions[svc];
    if (perm) {
      sanitized[svc] = {
        read: perm.read === true,
        write: perm.write === true,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("partner_settings")
    .upsert(
      {
        user_id: user.id,
        tool_permissions: sanitized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
