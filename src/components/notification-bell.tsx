"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  MessageSquare,
  Share2,
  Calendar,
  Shield,
  FileText,
  Check,
  AlertTriangle,
  CreditCard,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  requestNotificationPermission,
  sendDesktopNotification,
} from "@/lib/notifications/desktop";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  chat_mention: MessageSquare,
  share: Share2,
  schedule_started: Loader2,
  schedule_complete: Calendar,
  approval_needed: Shield,
  library_update: FileText,
  system_alert: AlertTriangle,
  credit_low: CreditCard,
};

function playNotificationPing() {
  try {
    const soundEnabled = localStorage.getItem("notification-sound") !== "off";
    if (!soundEnabled) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* audio not available */
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      const incoming: Notification[] = data.notifications ?? [];

      // Fire desktop notifications + sound for genuinely new unread items
      // (skip on first fetch so we don't spam on page load)
      if (initialFetchDone.current) {
        const newItems = incoming.filter(n => !n.is_read && !seenIdsRef.current.has(n.id));
        if (newItems.length > 0) {
          // Only send ONE desktop notification (not one per item)
          const first = newItems[0];
          const title = newItems.length === 1 ? first.title : `${newItems.length} new notifications`;
          const body = newItems.length === 1 ? (first.body ?? "") : newItems.map(n => n.title).join(", ");
          sendDesktopNotification(title, body, first.link ?? undefined);
          playNotificationPing();
        }
      }

      // Track ALL IDs (read + unread) so we never re-notify
      for (const n of incoming) {
        seenIdsRef.current.add(n.id);
      }
      initialFetchDone.current = true;

      setNotifications(incoming);
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      // Silently fail — polling will retry
    }
  }, []);

  // Request desktop notification permission on mount
  // Chrome blocks auto-requests, so we also request on first bell click
  const permissionRequested = useRef(false);
  useEffect(() => {
    // Try on mount (works in Safari, may be blocked in Chrome)
    requestNotificationPermission();
  }, []);

  const ensurePermission = useCallback(() => {
    if (!permissionRequested.current) {
      permissionRequested.current = true;
      requestNotificationPermission().then((granted) => {
        if (granted) console.log("[notifications] Desktop notifications enabled");
      });
    }
  }, []);

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  // Refetch when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const clearOld = async () => {
    setLoading(true);
    await fetch("/api/notifications/clear-old", { method: "DELETE" });
    await fetchNotifications();
    setLoading(false);
  };

  const handleClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) ensurePermission(); }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex items-center rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
            collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2 w-full"
          )}
          title={collapsed ? `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}` : undefined}
        >
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Notifications</span>}
          {unreadCount > 0 && (
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none",
                collapsed
                  ? "absolute -top-0.5 -right-0.5 h-4 w-4"
                  : "ml-auto h-5 min-w-5 px-1"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={markAllRead}
              disabled={loading}
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] ?? Bell;
              return (
                <button
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                    !notification.is_read && "bg-accent/20"
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          !notification.is_read && "font-medium"
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    {notification.body && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      {relativeTime(notification.created_at)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t px-4 py-2 flex flex-col gap-1">
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto flex-1 px-2 py-1.5 text-xs text-muted-foreground"
                onClick={markAllRead}
                disabled={loading}
              >
                Dismiss all
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto flex-1 px-2 py-1.5 text-xs text-muted-foreground"
              onClick={clearOld}
              disabled={loading}
            >
              Clear old
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full px-2 py-1.5 text-xs text-muted-foreground"
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
          >
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
