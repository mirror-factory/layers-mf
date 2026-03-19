/** Fire-and-forget interaction tracking via sendBeacon or fetch */
export function trackInteraction(params: {
  type: string;
  resourceType?: string;
  resourceId?: string;
  sourceType?: string;
  contentType?: string;
  query?: string;
  metadata?: Record<string, unknown>;
}): void {
  try {
    const payload = JSON.stringify(params);
    const url = "/api/interactions";

    // Prefer sendBeacon for zero-impact on UX (works during page unload too)
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }

    // Fallback to fetch with keepalive
    if (typeof fetch !== "undefined") {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silent — tracking failures must never impact UX
      });
    }
  } catch {
    // Silent — tracking failures must never impact UX
  }
}

/**
 * Track dwell time on a page. Call on mount, returns a cleanup function
 * that sends the dwell event on unmount.
 */
export function trackDwell(params: {
  resourceType: string;
  resourceId: string;
  sourceType?: string;
  contentType?: string;
}): () => void {
  const startTime = Date.now();

  return () => {
    const dwellMs = Date.now() - startTime;
    // Only track if user spent at least 2 seconds
    if (dwellMs >= 2000) {
      trackInteraction({
        type: "dwell",
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        sourceType: params.sourceType,
        contentType: params.contentType,
        metadata: { dwellMs },
      });
    }
  };
}
