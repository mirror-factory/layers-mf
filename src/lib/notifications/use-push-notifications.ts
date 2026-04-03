"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { registerPushNotifications, setupNotificationHandlers } from "./push-registration";

/**
 * Hook to register push notifications and save device token.
 * Call once in a top-level layout/component.
 */
export function usePushNotifications() {
  const router = useRouter();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    (async () => {
      const token = await registerPushNotifications();
      if (!token) return;

      // Save token to server
      try {
        await fetch("/api/notifications/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform: "ios" }),
        });
      } catch (err) {
        console.error("[push] Failed to save token:", err);
      }

      // Handle notification taps
      setupNotificationHandlers((conversationId) => {
        router.push(`/chat?id=${conversationId}`);
      });
    })();
  }, [router]);
}
