/**
 * Portal Analytics — client-side event tracker
 *
 * Collects viewer behavior (page views, doc opens, messages, tool usage)
 * and sends to /api/portals/analytics on a periodic basis + on unload.
 *
 * Usage:
 *   const tracker = createPortalTracker("bluewave-demo");
 *   tracker.trackPageView(3);
 *   tracker.trackDocOpen("Scope of Work");
 *   tracker.trackMessage("What is the budget?");
 *   tracker.trackToolUse("highlight_text");
 *   tracker.trackVoiceActivated();
 *   tracker.flush(); // sends immediately
 *   tracker.destroy(); // cleanup on unmount
 */

type EventType =
  | "page_view"
  | "doc_open"
  | "chat_message"
  | "tool_use"
  | "voice_activated"
  | "session_start"
  | "session_end";

interface QueuedEvent {
  event_type: EventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface PortalTracker {
  trackPageView: (page: number) => void;
  trackDocOpen: (title: string) => void;
  trackMessage: (text: string) => void;
  trackToolUse: (toolName: string) => void;
  trackVoiceActivated: () => void;
  flush: () => Promise<void>;
  destroy: () => void;
  sessionId: string;
}

function generateSessionId(): string {
  return `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPortalTracker(shareToken: string): PortalTracker {
  const sessionId = generateSessionId();
  const queue: QueuedEvent[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  function enqueue(event_type: EventType, payload: Record<string, unknown>) {
    if (destroyed) return;
    queue.push({ event_type, payload, timestamp: Date.now() });
  }

  async function flush() {
    if (queue.length === 0) return;
    const batch = queue.splice(0, queue.length);

    for (const event of batch) {
      try {
        // Use sendBeacon for reliability on page unload, fetch otherwise
        const body = JSON.stringify({
          share_token: shareToken,
          session_id: sessionId,
          event_type: event.event_type,
          payload: { ...event.payload, client_timestamp: event.timestamp },
        });

        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/portals/analytics",
            new Blob([body], { type: "application/json" })
          );
        } else {
          await fetch("/api/portals/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          });
        }
      } catch {
        // Silently fail — analytics should never break the portal
      }
    }
  }

  // Auto-flush every 30 seconds
  if (typeof window !== "undefined") {
    flushTimer = setInterval(flush, 30_000);

    // Flush on page unload
    window.addEventListener("beforeunload", () => {
      enqueue("session_end", {
        duration_seconds: Math.round((Date.now() - parseInt(sessionId.split("_")[1])) / 1000),
      });
      flush();
    });
  }

  // Track session start immediately
  enqueue("session_start", {});

  return {
    sessionId,

    trackPageView(page: number) {
      enqueue("page_view", { page });
    },

    trackDocOpen(title: string) {
      enqueue("doc_open", { title });
    },

    trackMessage(text: string) {
      enqueue("chat_message", { text_length: text.length });
    },

    trackToolUse(toolName: string) {
      enqueue("tool_use", { tool: toolName });
    },

    trackVoiceActivated() {
      enqueue("voice_activated", {});
    },

    flush,

    destroy() {
      destroyed = true;
      if (flushTimer) clearInterval(flushTimer);
      flush(); // Final flush
    },
  };
}
