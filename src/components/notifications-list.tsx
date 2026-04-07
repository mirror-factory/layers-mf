"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  MessageSquare,
  Share2,
  Calendar,
  Shield,
  FileText,
  AlertTriangle,
  CreditCard,
  Loader2,
  Check,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  chat_mention: { label: "Mention", icon: MessageSquare },
  share: { label: "Share", icon: Share2 },
  schedule_started: { label: "Executing", icon: Loader2 },
  schedule_complete: { label: "Schedule", icon: Calendar },
  approval_needed: { label: "Approval", icon: Shield },
  library_update: { label: "Library", icon: FileText },
  system_alert: { label: "Alert", icon: AlertTriangle },
  credit_low: { label: "Credits", icon: CreditCard },
};

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

export function NotificationsList({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<string>("all");

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await fetch("/api/notifications/read-all", { method: "POST" });
  };

  const handleClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const filtered =
    filter === "all"
      ? notifications
      : filter === "unread"
        ? notifications.filter((n) => !n.is_read)
        : notifications.filter((n) => n.type === filter);

  // Count by type for filter badges
  const typeCounts = notifications.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Inbox className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium text-foreground">No notifications</p>
        <p className="text-xs mt-1 max-w-xs text-center">
          Notifications from schedules, agents, and team activity will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={filter === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("all")}
        >
          All {notifications.length}
        </Badge>
        {unreadCount > 0 && (
          <Badge
            variant={filter === "unread" ? "default" : "outline"}
            className="cursor-pointer text-blue-600 border-blue-500/30"
            onClick={() => setFilter(filter === "unread" ? "all" : "unread")}
          >
            Unread {unreadCount}
          </Badge>
        )}
        {Object.entries(typeCounts).map(([type, count]) => {
          const config = TYPE_CONFIG[type];
          if (!config) return null;
          return (
            <Badge
              key={type}
              variant={filter === type ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter(filter === type ? "all" : type)}
            >
              {config.label} {count}
            </Badge>
          );
        })}
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-muted-foreground"
            onClick={markAllRead}
          >
            <Check className="mr-1 h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification items */}
      {filtered.map((notification) => {
        const config = TYPE_CONFIG[notification.type] ?? {
          label: notification.type,
          icon: Bell,
        };
        const Icon = config.icon;

        return (
          <button
            key={notification.id}
            onClick={() => handleClick(notification)}
            className={cn(
              "group flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:shadow-sm",
              !notification.is_read && "border-l-2 border-l-blue-500 bg-accent/20"
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                !notification.is_read ? "bg-blue-500/10" : "bg-muted"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  !notification.is_read
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground"
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {config.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {relativeTime(notification.created_at)}
                </span>
                {!notification.is_read && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
              <p
                className={cn(
                  "text-sm leading-snug",
                  !notification.is_read && "font-medium"
                )}
              >
                {notification.title}
              </p>
              {notification.body && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {notification.body}
                </p>
              )}
            </div>
          </button>
        );
      })}

      {filtered.length === 0 && filter !== "all" && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No notifications match this filter.
          <button
            onClick={() => setFilter("all")}
            className="ml-1 text-primary hover:underline"
          >
            Show all
          </button>
        </div>
      )}
    </div>
  );
}
