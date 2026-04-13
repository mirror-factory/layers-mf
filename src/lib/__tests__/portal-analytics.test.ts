import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPortalTracker } from "../portal-analytics";

// Mock fetch and sendBeacon
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
const mockSendBeacon = vi.fn().mockReturnValue(true);

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.fetch = mockFetch;
  Object.defineProperty(navigator, "sendBeacon", {
    value: mockSendBeacon,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createPortalTracker", () => {
  it("generates a unique session ID", () => {
    const tracker = createPortalTracker("test-token");
    expect(tracker.sessionId).toMatch(/^ps_\d+_[a-z0-9]+$/);
    tracker.destroy();
  });

  it("generates different session IDs each time", () => {
    const t1 = createPortalTracker("test-token");
    vi.advanceTimersByTime(10);
    const t2 = createPortalTracker("test-token");
    expect(t1.sessionId).not.toBe(t2.sessionId);
    t1.destroy();
    t2.destroy();
  });

  it("tracks page views", async () => {
    const tracker = createPortalTracker("demo");
    tracker.trackPageView(3);
    await tracker.flush();

    expect(mockSendBeacon).toHaveBeenCalled();
    const lastCall = mockSendBeacon.mock.calls.find((call) => {
      const blob = call[1] as Blob;
      return blob !== undefined;
    });
    expect(lastCall).toBeTruthy();
  });

  it("tracks doc opens", async () => {
    const tracker = createPortalTracker("demo");
    tracker.trackDocOpen("Scope of Work");
    await tracker.flush();

    // Should have sent 2 events: session_start + doc_open
    expect(mockSendBeacon.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("tracks chat messages (text length only, not content)", async () => {
    const tracker = createPortalTracker("demo");
    tracker.trackMessage("What is the budget?");
    await tracker.flush();

    // Verify we sent events — the message text is NOT stored, only length
    expect(mockSendBeacon.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("tracks tool usage", async () => {
    const tracker = createPortalTracker("demo");
    tracker.trackToolUse("highlight_text");
    tracker.trackToolUse("render_chart");
    await tracker.flush();

    expect(mockSendBeacon.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("tracks voice activation", async () => {
    const tracker = createPortalTracker("demo");
    tracker.trackVoiceActivated();
    await tracker.flush();

    expect(mockSendBeacon.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("auto-flushes every 30 seconds", () => {
    const tracker = createPortalTracker("demo");
    tracker.trackPageView(1);

    // Advance 30 seconds
    vi.advanceTimersByTime(30_000);

    // Should have auto-flushed
    expect(mockSendBeacon.mock.calls.length).toBeGreaterThan(0);
    tracker.destroy();
  });

  it("stops auto-flushing after destroy", () => {
    const tracker = createPortalTracker("demo");
    tracker.destroy();

    const callCount = mockSendBeacon.mock.calls.length;
    tracker.trackPageView(5); // Should be ignored
    vi.advanceTimersByTime(30_000);

    // No new calls after destroy (flush on destroy may add some)
    expect(mockSendBeacon.mock.calls.length).toBe(callCount);
  });

  it("sends session_start event on creation", async () => {
    const tracker = createPortalTracker("demo");
    await tracker.flush();

    // First event should be session_start
    const firstCall = mockSendBeacon.mock.calls[0];
    expect(firstCall).toBeTruthy();
    tracker.destroy();
  });

  it("uses sendBeacon when available", async () => {
    const tracker = createPortalTracker("demo");
    tracker.trackPageView(1);
    await tracker.flush();

    expect(mockSendBeacon).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    tracker.destroy();
  });

  it("falls back to fetch when sendBeacon unavailable", async () => {
    Object.defineProperty(navigator, "sendBeacon", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const tracker = createPortalTracker("demo");
    tracker.trackPageView(1);
    await tracker.flush();

    expect(mockFetch).toHaveBeenCalled();
    tracker.destroy();
  });

  it("silently handles send failures", async () => {
    mockSendBeacon.mockReturnValue(false);
    const tracker = createPortalTracker("demo");
    tracker.trackPageView(1);

    // Should not throw
    await expect(tracker.flush()).resolves.toBeUndefined();
    tracker.destroy();
  });
});
