/**
 * Desktop Notification API helpers.
 * Works in browsers that support the Notification API (most modern browsers).
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function canSendDesktopNotification(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted";
}

export function sendDesktopNotification(
  title: string,
  body: string,
  link?: string,
): void {
  if (!canSendDesktopNotification()) return;
  const n = new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: `layers-${Date.now()}`,
  });
  if (link) {
    n.onclick = () => {
      window.focus();
      window.open(link, "_self");
    };
  }
}
