import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateInboxForUser } from "@/lib/inbox/generate";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch all orgs with members
  const { data: members, error: membersError } = await supabase
    .from("org_members")
    .select("org_id, user_id");

  if (membersError) {
    return Response.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return Response.json({ generated: 0, users: 0 });
  }

  let totalGenerated = 0;
  let usersProcessed = 0;
  const errors: string[] = [];

  for (const { org_id, user_id } of members) {
    try {
      const count = await generateInboxForUser(supabase, org_id, user_id, since);
      totalGenerated += count;
      usersProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${org_id}/${user_id}: ${msg}`);
    }
  }

  return Response.json({
    generated: totalGenerated,
    users: usersProcessed,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// Vercel Crons send GET requests
export async function GET(request: NextRequest) {
  return POST(request);
}
