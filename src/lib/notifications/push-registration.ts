"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

/**
 * Register for push notifications on iOS/Android via Capacitor.
 * Returns the device token or null if not on a native platform.
 */
export async function registerPushNotifications(): Promise<string | null> {
  // Only works on native platforms (not web)
  if (!Capacitor.isNativePlatform()) return null;

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.log("[push] Permission not granted");
      return null;
    }

    // Register with APNs/FCM
    await PushNotifications.register();

    // Wait for registration token
    return new Promise((resolve) => {
      PushNotifications.addListener("registration", (token) => {
        console.log("[push] Token:", token.value);
        resolve(token.value);
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("[push] Registration error:", error);
        resolve(null);
      });

      // Timeout after 10s
      setTimeout(() => resolve(null), 10_000);
    });
  } catch (err) {
    console.error("[push] Failed:", err);
    return null;
  }
}

/**
 * Set up notification tap handler — navigates to the conversation.
 */
export function setupNotificationHandlers(
  onTap: (conversationId: string) => void
) {
  if (!Capacitor.isNativePlatform()) return;

  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (notification) => {
      const conversationId = notification.notification.data?.conversationId;
      if (conversationId) {
        onTap(conversationId);
      }
    }
  );
}
