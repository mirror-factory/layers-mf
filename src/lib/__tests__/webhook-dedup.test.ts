import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase admin client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLt = vi.fn();
const mockMaybeSingle = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
};

// Chain mocks for insert path
mockInsert.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle });

// Chain mocks for update path
mockUpdate.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ eq: mockEq, data: null, error: null });

// Chain mocks for delete path
mockDelete.mockReturnValue({ lt: mockLt });
mockLt.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) });

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockSupabase,
}));

import {
  claimWebhookEvent,
  completeWebhookEvent,
  cleanupOldEvents,
  hashPayload,
} from "../webhook-dedup";

describe("webhook-dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default chain behavior
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, data: null, error: null });
    mockDelete.mockReturnValue({ lt: mockLt });
    mockLt.mockReturnValue({ select: vi.fn(() => ({ data: [], error: null })) });
  });

  describe("claimWebhookEvent", () => {
    it("returns true for a new event (insert succeeds)", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "new-uuid" },
        error: null,
      });

      const result = await claimWebhookEvent("stripe", "evt_123", "checkout.session.completed");
      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("webhook_events");
      expect(mockInsert).toHaveBeenCalledWith({
        provider: "stripe",
        event_id: "evt_123",
        event_type: "checkout.session.completed",
        status: "processing",
      });
    });

    it("returns false for a duplicate event (unique constraint violation)", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      });

      const result = await claimWebhookEvent("stripe", "evt_123", "checkout.session.completed");
      expect(result).toBe(false);
    });

    it("returns true on unexpected errors (fail open to avoid dropping events)", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { code: "42P01", message: "relation does not exist" },
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await claimWebhookEvent("stripe", "evt_456");
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("handles missing event_type gracefully", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "new-uuid" },
        error: null,
      });

      const result = await claimWebhookEvent("linear", "issue-create-abc");
      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: null })
      );
    });

    it("different events can be claimed independently", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "uuid-1" },
        error: null,
      });

      const result1 = await claimWebhookEvent("stripe", "evt_100", "checkout.session.completed");
      expect(result1).toBe(true);

      mockMaybeSingle.mockResolvedValue({
        data: { id: "uuid-2" },
        error: null,
      });

      const result2 = await claimWebhookEvent("stripe", "evt_200", "invoice.payment_failed");
      expect(result2).toBe(true);

      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("completeWebhookEvent", () => {
    it("updates status to completed with processed_at timestamp", async () => {
      const mockEqChain = vi.fn().mockReturnValue({ data: null, error: null });
      const mockEqFirst = vi.fn().mockReturnValue({ eq: mockEqChain });
      mockUpdate.mockReturnValue({ eq: mockEqFirst });

      await completeWebhookEvent("stripe", "evt_123", "completed");

      expect(mockSupabase.from).toHaveBeenCalledWith("webhook_events");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          processed_at: expect.any(String),
        })
      );
      expect(mockEqFirst).toHaveBeenCalledWith("provider", "stripe");
      expect(mockEqChain).toHaveBeenCalledWith("event_id", "evt_123");
    });

    it("updates status to failed with null processed_at", async () => {
      const mockEqChain = vi.fn().mockReturnValue({ data: null, error: null });
      const mockEqFirst = vi.fn().mockReturnValue({ eq: mockEqChain });
      mockUpdate.mockReturnValue({ eq: mockEqFirst });

      await completeWebhookEvent("linear", "issue-create-abc", "failed");

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          processed_at: null,
        })
      );
    });

    it("logs error but does not throw on DB failure", async () => {
      const mockEqChain = vi.fn().mockReturnValue({
        data: null,
        error: { message: "connection failed" },
      });
      const mockEqFirst = vi.fn().mockReturnValue({ eq: mockEqChain });
      mockUpdate.mockReturnValue({ eq: mockEqFirst });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await completeWebhookEvent("stripe", "evt_bad", "completed");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("cleanupOldEvents", () => {
    it("deletes events older than 7 days and returns count", async () => {
      const mockSelectAfterDelete = vi.fn().mockReturnValue({
        data: [{ id: "a" }, { id: "b" }, { id: "c" }],
        error: null,
      });
      mockLt.mockReturnValue({ select: mockSelectAfterDelete });

      const count = await cleanupOldEvents();
      expect(count).toBe(3);
      expect(mockSupabase.from).toHaveBeenCalledWith("webhook_events");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockLt).toHaveBeenCalledWith("created_at", expect.any(String));
    });

    it("returns 0 on error", async () => {
      const mockSelectAfterDelete = vi.fn().mockReturnValue({
        data: null,
        error: { message: "connection failed" },
      });
      mockLt.mockReturnValue({ select: mockSelectAfterDelete });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const count = await cleanupOldEvents();
      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });

    it("returns 0 when no old events exist", async () => {
      const mockSelectAfterDelete = vi.fn().mockReturnValue({
        data: [],
        error: null,
      });
      mockLt.mockReturnValue({ select: mockSelectAfterDelete });

      const count = await cleanupOldEvents();
      expect(count).toBe(0);
    });
  });

  describe("hashPayload", () => {
    it("returns consistent SHA-256 hash for the same input", () => {
      const hash1 = hashPayload('{"type":"test"}');
      const hash2 = hashPayload('{"type":"test"}');
      expect(hash1).toBe(hash2);
    });

    it("returns a 64-character hex string", () => {
      const hash = hashPayload("some payload");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns different hashes for different inputs", () => {
      const hash1 = hashPayload("payload A");
      const hash2 = hashPayload("payload B");
      expect(hash1).not.toBe(hash2);
    });
  });
});
