"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  registerPushNotifications,
  setupPushListeners,
} from "./push-registration";

/**
 * Hook to register push notifications and handle taps.
 * Call once in a top-level layout/component.
 *
 * registerPushNotifications() handles both APNs registration
 * and sending the token to our server.
 */
export function usePushNotifications() {
  const router = useRouter();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    // Register for push + save token to server
    registerPushNotifications();

    // Handle notification taps -- navigate to the linked page
    setupPushListeners((link) => {
      router.push(link);
    });
  }, [router]);
}
