'use client';

/**
 * Request permission for desktop notifications.
 * Call this on app load or when user enables notifications.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show a desktop notification.
 */
export function showNotification(title: string, options?: {
  body?: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
  autoClose?: number; // ms, default 5000
}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;

  const notification = new Notification(title, {
    body: options?.body,
    icon: options?.icon ?? '/icon.png',
    tag: options?.tag, // prevents duplicate notifications with same tag
    badge: '/icon.png',
  });

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }

  // Auto-close after timeout
  setTimeout(() => notification.close(), options?.autoClose ?? 5000);

  return notification;
}

/**
 * Show a Granger-branded notification
 */
export function grangerNotify(message: string, options?: {
  body?: string;
  tag?: string;
  url?: string;
}) {
  return showNotification(`Granger: ${message}`, {
    body: options?.body,
    tag: options?.tag ?? 'granger',
    onClick: options?.url ? () => window.open(options.url, '_self') : undefined,
  });
}
