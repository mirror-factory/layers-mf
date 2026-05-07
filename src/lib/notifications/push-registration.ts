"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

/**
 * Register for push notifications on iOS/Android via Capacitor.
 * Requests permission, registers with APNs/FCM, and sends
 * the device token to our server for storage.
 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      console.log("[push] Permission denied");
      return null;
    }

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        console.log("[push] Token:", token.value);

        // Send token to our server for storage
        try {
          await fetch("/api/notifications/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: token.value,
              platform: Capacitor.getPlatform(), // "ios" or "android"
            }),
          });
          console.log("[push] Token registered with server");
        } catch (err) {
          console.error("[push] Failed to register token:", err);
        }

        resolve(token.value);
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("[push] Registration error:", err);
        resolve(null);
      });

      // Timeout after 10s
      setTimeout(() => resolve(null), 10_000);
    });
  } catch (err) {
    console.error("[push] Error:", err);
    return null;
  }
}

/**
 * Set up push notification listeners for foreground and tap events.
 */
export function setupPushListeners(
  onNotificationTap?: (link: string) => void,
): void {
  if (!Capacitor.isNativePlatform()) return;

  // Foreground notification -- could show an in-app toast
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[push] Received in foreground:", notification.title);
  });

  // Notification tap from background/killed state
  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      const data = action.notification.data;
      // Support both `link` (new) and `conversationId` (legacy) formats
      if (data?.link && onNotificationTap) {
        onNotificationTap(data.link);
      } else if (data?.conversationId && onNotificationTap) {
        onNotificationTap(`/chat?id=${data.conversationId}`);
      }
    },
  );
}
