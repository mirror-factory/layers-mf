import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAudit } from "./audit";

function createMockSupabase() {
  const thenFn = vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn().mockReturnValue({ then: thenFn });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
  return { client: { from: fromFn } as unknown as Parameters<typeof logAudit>[0], fromFn, insertFn };
}

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an audit entry with all fields", () => {
    const { client, fromFn, insertFn } = createMockSupabase();

    logAudit(client, {
      orgId: "org-1",
      userId: "user-1",
      action: "context.create",
      resourceType: "context_item",
      resourceId: "ci-1",
      metadata: { source: "upload" },
    });

    expect(fromFn).toHaveBeenCalledWith("audit_log");
    expect(insertFn).toHaveBeenCalledWith({
      org_id: "org-1",
      user_id: "user-1",
      action: "context.create",
      resource_type: "context_item",
      resource_id: "ci-1",
      metadata: { source: "upload" },
    });
  });

  it("defaults optional fields to null and empty object", () => {
    const { client, insertFn } = createMockSupabase();

    logAudit(client, {
      orgId: "org-2",
      action: "session.delete",
    });

    expect(insertFn).toHaveBeenCalledWith({
      org_id: "org-2",
      user_id: null,
      action: "session.delete",
      resource_type: null,
      resource_id: null,
      metadata: {},
    });
  });

  it("does not throw on insert failure (fire and forget)", () => {
    const thenFn = vi.fn().mockRejectedValue(new Error("DB down"));
    const insertFn = vi.fn().mockReturnValue({ then: thenFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
    const client = { from: fromFn } as unknown as Parameters<typeof logAudit>[0];

    expect(() =>
      logAudit(client, { orgId: "org-3", action: "test.action" })
    ).not.toThrow();
  });

  it("passes correct table name to from()", () => {
    const { client, fromFn } = createMockSupabase();

    logAudit(client, { orgId: "org-1", action: "any.action" });

    expect(fromFn).toHaveBeenCalledTimes(1);
    expect(fromFn).toHaveBeenCalledWith("audit_log");
  });

  it("handles explicit null userId and resourceId", () => {
    const { client, insertFn } = createMockSupabase();

    logAudit(client, {
      orgId: "org-4",
      userId: null,
      action: "system.cleanup",
      resourceType: null,
      resourceId: null,
    });

    expect(insertFn).toHaveBeenCalledWith({
      org_id: "org-4",
      user_id: null,
      action: "system.cleanup",
      resource_type: null,
      resource_id: null,
      metadata: {},
    });
  });

  it("preserves complex metadata objects", () => {
    const { client, insertFn } = createMockSupabase();
    const complexMeta = {
      changes: { before: { name: "old" }, after: { name: "new" } },
      tags: ["important", "reviewed"],
      count: 42,
    };

    logAudit(client, {
      orgId: "org-5",
      userId: "user-5",
      action: "context.update",
      resourceType: "context_item",
      resourceId: "ci-5",
      metadata: complexMeta,
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: complexMeta })
    );
  });

  it("handles different action types correctly", () => {
    const actions = [
      "context.create",
      "context.delete",
      "context.update",
      "session.start",
      "session.end",
      "member.invite",
      "member.remove",
    ];

    for (const action of actions) {
      const { client, insertFn } = createMockSupabase();
      logAudit(client, { orgId: "org-6", action });
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({ action })
      );
    }
  });
});
