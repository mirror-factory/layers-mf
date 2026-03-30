import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/api/google-auth";

/**
 * GET /api/auth/google/start
 * Redirects the authenticated user to Google OAuth consent screen.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
