import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { renewDriveWatch } from "@/lib/integrations/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/drive-watch-renewal
 * Vercel Cron: every 20 hours (before 24h expiry) — 0 *\/20 * * *
 *
 * Renews Google Drive push notification channels that are expiring
 * within the next 6 hours. Each watch channel lasts 24h (Google's max
 * for non-verified domains), so running every 20h ensures we always
 * renew before expiry.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch all active Google Drive integrations with watch metadata
  const { data: integrations, error } = await supabase
    .from("integrations")
    .select("id, org_id, provider, nango_connection_id, sync_config")
    .eq("provider", "google-drive")
    .eq("status", "active");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!integrations || integrations.length === 0) {
    return Response.json({ renewed: 0, total: 0 });
  }

  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const now = Date.now();

  let renewed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const integration of integrations) {
    try {
      const syncConfig = integration.sync_config as Record<string, unknown> | null;
      const watch = syncConfig?.watch as {
        channelId?: string;
        resourceId?: string;
        expiration?: string;
      } | undefined;

      // If no watch channel exists, register a fresh one
      if (!watch?.expiration) {
        const result = await renewDriveWatch(
          integration.nango_connection_id,
          integration.provider,
          integration.org_id,
        );
        if (result) {
          renewed++;
        } else {
          errors.push(`integration ${integration.id}: failed to register initial watch`);
        }
        continue;
      }

      // Check if the channel expires within the next 6 hours
      const expiresAt = new Date(watch.expiration).getTime();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry < SIX_HOURS_MS) {
        const result = await renewDriveWatch(
          integration.nango_connection_id,
          integration.provider,
          integration.org_id,
        );
        if (result) {
          renewed++;
          console.log(
            `[drive-watch-renewal] Renewed channel for integration ${integration.id} (was expiring in ${Math.round(timeUntilExpiry / 60000)}min)`,
          );
        } else {
          errors.push(`integration ${integration.id}: renewal failed`);
        }
      } else {
        skipped++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`integration ${integration.id}: ${message}`);
    }
  }

  return Response.json({
    renewed,
    skipped,
    total: integrations.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
