import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AuthenticatedOrg = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  user: { id: string; email?: string | null };
  orgId: string;
};

export type AuthResult =
  | AuthenticatedOrg
  | { response: NextResponse };

export function isAuthFailure(result: AuthResult): result is { response: NextResponse } {
  return "response" in result;
}

export async function requireUserAndOrg(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return {
      response: NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      ),
    };
  }

  return {
    supabase,
    user: { id: user.id, email: user.email },
    orgId: member.org_id,
  };
}
