"use client";

import { usePushNotifications } from "@/lib/notifications/use-push-notifications";

/**
 * Drop this component into a layout to auto-register push notifications.
 * Only activates on native platforms (Capacitor iOS/Android).
 */
export function PushNotificationProvider() {
  usePushNotifications();
  return null;
}
