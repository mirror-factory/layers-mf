/**
 * Server-side: send a push notification to a user's device via APNs.
 *
 * For now, uses a simple fetch to a push service.
 * In production, wire this up to Firebase Cloud Messaging (FCM) or APNs directly.
 */

import { createAdminClient } from "@/lib/supabase/server";

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Get device tokens for a user.
 */
export async function getDeviceTokens(userId: string) {
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("device_tokens")
    .select("token, platform")
    .eq("user_id", userId);
  return data ?? [];
}

/**
 * Send push notification.
 * This is a placeholder — in production, connect to APNs/FCM.
 *
 * To enable:
 * 1. Set up Firebase Cloud Messaging or APNs
 * 2. Add FCM_SERVER_KEY or APNs credentials to env
 * 3. Replace the TODO below with actual send logic
 */
export async function sendPushNotification(payload: PushPayload) {
  const tokens = await getDeviceTokens(payload.userId);

  if (tokens.length === 0) {
    console.log("[push] No device tokens for user", payload.userId);
    return;
  }

  for (const { token, platform } of tokens) {
    console.log(`[push] Would send to ${platform} token ${token.slice(0, 8)}...`, {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });

    // TODO: Send via APNs or FCM
    // For APNs: use `apn` package or HTTP/2 to api.push.apple.com
    // For FCM: POST to https://fcm.googleapis.com/fcm/send with FCM_SERVER_KEY
  }
}
