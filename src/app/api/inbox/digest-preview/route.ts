import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDigestForUser } from "@/lib/email/digest";
import { renderDigestHTML } from "@/lib/email/digest-template";

export async function GET() {
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

  const data = await generateDigestForUser(supabase, user.id, member.org_id);

  if (!data) {
    return NextResponse.json({
      html: null,
      data: null,
      wouldSend: false,
    });
  }

  const html = renderDigestHTML(data);

  return NextResponse.json({
    html,
    data,
    wouldSend: true,
  });
}
