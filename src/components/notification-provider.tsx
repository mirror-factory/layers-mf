'use client';

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { requestNotificationPermission, grangerNotify } from '@/lib/notifications';

interface ScheduleEvent {
  id: string;
  name: string;
  status: string;
  description: string | null;
  target_service: string | null;
  last_run_at: string | null;
}

interface ApprovalEvent {
  id: string;
  action_type: string;
  reasoning: string;
}

interface InboxEvent {
  id: string;
  title: string;
}

interface SystemChatEvent {
  id: string;
  title: string | null;
}

export function NotificationProvider() {
  const permissionGranted = useRef(false);
  const seenIdsRef = useRef(new Set<string>());

  // Request permission on mount
  useEffect(() => {
    requestNotificationPermission().then(granted => {
      permissionGranted.current = granted;
    });
  }, []);

  const notify = useCallback((title: string, body: string, tag: string, url: string) => {
    // Deduplicate within session
    if (seenIdsRef.current.has(tag)) return;
    seenIdsRef.current.add(tag);

    // Desktop notification (if permitted)
    if (permissionGranted.current) {
      grangerNotify(title, { body, tag, url });
    }

    // In-app toast as fallback (always shown)
    toast(title, {
      description: body,
      action: {
        label: 'View',
        onClick: () => window.open(url, '_self'),
      },
    });
  }, []);

  // Poll for completed schedule runs every 30 seconds
  const checkForUpdates = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/poll');
      if (!res.ok) return;
      const data = await res.json();

      // Build a set of system chat IDs so schedule events can link to them
      const systemChats = (data.systemChats ?? []) as SystemChatEvent[];

      // Check for newly completed schedule runs
      for (const event of (data.events ?? []) as ScheduleEvent[]) {
        const isLinear = event.target_service === 'linear' || event.name.toLowerCase().includes('linear');
        const body = event.description ?? `Scheduled task completed: ${event.name}`;
        const url = isLinear ? '/context?q=Linear+Status' : '/schedules';

        notify(
          `Granger: ${event.name}`,
          body,
          `schedule-${event.id}-${event.last_run_at ?? event.id}`,
          url,
        );
      }

      // Check for new approval requests
      for (const approval of (data.approvals ?? []) as ApprovalEvent[]) {
        notify(
          'Approval Required',
          approval.reasoning,
          `approval-${approval.id}`,
          '/approvals',
        );
      }

      // Check for new inbox items
      for (const inbox of (data.inbox ?? []) as InboxEvent[]) {
        notify(
          'New Inbox Item',
          inbox.title,
          `inbox-${inbox.id}`,
          '/inbox',
        );
      }

      // Check for system-initiated conversations (from schedules, etc.)
      for (const chat of systemChats) {
        notify(
          chat.title || 'Schedule completed',
          'Click to see results and follow up',
          `system-chat-${chat.id}`,
          `/chat?id=${chat.id}`,
        );
      }
    } catch {
      // Silently fail - notifications are non-critical
    }
  }, [notify]);

  useEffect(() => {
    // Initial check after a short delay to let the app settle
    const timeout = setTimeout(checkForUpdates, 3000);

    // Poll every 30 seconds
    const interval = setInterval(checkForUpdates, 30_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  return null; // This component renders nothing - it's just a side effect
}
