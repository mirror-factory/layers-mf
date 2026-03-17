import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateDigestForUser } from "@/lib/email/digest";
import { renderDigestHTML } from "@/lib/email/digest-template";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch users with digest_enabled = true
  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("user_id, org_id")
    .eq("digest_enabled", true);

  if (prefsError) {
    return Response.json({ error: prefsError.message }, { status: 500 });
  }

  if (!prefs || prefs.length === 0) {
    return Response.json({ processed: 0, sent: 0, skipped: 0 });
  }

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const digests: { userId: string; html: string }[] = [];

  for (const { user_id, org_id } of prefs) {
    try {
      processed++;
      const data = await generateDigestForUser(supabase, user_id, org_id);

      if (!data) {
        skipped++;
        continue;
      }

      const html = renderDigestHTML(data);

      // TODO: Send email via Resend when configured
      // For now, collect digests for the response
      digests.push({ userId: user_id, html });
      sent++;

      console.log(
        `[digest] Generated for user ${user_id}: ${data.items.length} items, ${data.overdueActions.length} overdue`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${user_id}: ${msg}`);
    }
  }

  return Response.json({
    processed,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
