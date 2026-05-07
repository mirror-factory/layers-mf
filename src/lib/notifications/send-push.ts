/**
 * Server-side push notification sender.
 * Looks up a user's device tokens and sends via APNs (iOS) or logs for other platforms.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { sendAPNs } from "./apns";

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
}

/**
 * Get all device tokens for a user.
 */
async function getDeviceTokens(userId: string) {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("device_tokens")
    .select("id, token, platform")
    .eq("user_id", userId);
  return (data ?? []) as { id: string; token: string; platform: string }[];
}

/**
 * Remove an invalid/expired device token from the database.
 */
async function removeToken(tokenId: string) {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("device_tokens").delete().eq("id", tokenId);
}

/**
 * Send a push notification to all of a user's registered devices.
 * Silently skips if no tokens exist or APNs credentials are not configured.
 * Automatically cleans up invalid tokens.
 */
export async function sendPushNotification(payload: PushPayload): Promise<{
  sent: number;
  failed: number;
}> {
  const tokens = await getDeviceTokens(payload.userId);

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const { id, token, platform } of tokens) {
    if (platform === "ios") {
      const result = await sendAPNs({
        token,
        title: payload.title,
        body: payload.body,
        link: payload.link,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
        // Clean up invalid tokens automatically
        if (result.tokenInvalid) {
          console.log(`[push] Removing invalid token ${token.slice(0, 8)}...`);
          await removeToken(id);
        }
      }
    } else {
      // Android/web -- not yet implemented
      console.log(
        `[push] Skipping ${platform} token ${token.slice(0, 8)}... (not implemented)`,
      );
      failed++;
    }
  }

  return { sent, failed };
}
