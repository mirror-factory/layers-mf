import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createLibraryItem: vi.fn(),
  assignLibraryItemToStacks: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireUserAndOrg: vi.fn().mockResolvedValue({
    supabase: { from: mocks.from },
    user: { id: "user-1" },
    orgId: "org-1",
  }),
  isAuthFailure: (value: unknown) => Boolean(value && typeof value === "object" && "response" in value),
}));

vi.mock("@/lib/library/domain", () => ({
  createLibraryItem: mocks.createLibraryItem,
  assignLibraryItemToStacks: mocks.assignLibraryItemToStacks,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/library/inbox/inbox-1/curate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function chain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe("POST /api/library/inbox/[id]/curate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createLibraryItem.mockResolvedValue({ item: { id: "ctx-new" } });
    mocks.assignLibraryItemToStacks.mockResolvedValue({ assigned: true });
  });

  it("creates a Library Item from an unsaved Inbox item", async () => {
    const inboxChain = chain({
      data: {
        id: "inbox-1",
        title: "Decision from call",
        body: "We should ship the Library Layer first.",
        type: "decision",
        priority: "high",
        source_type: "meeting",
        source_url: "https://example.test/call",
        context_item_id: null,
        user_id: "user-1",
      },
      error: null,
    });
    const updateChain = chain({ data: null, error: null });
    mocks.from.mockImplementation((table: string) => table === "inbox_items" ? inboxChain : updateChain);
    inboxChain.update = updateChain.update;

    const response = await POST(request({ stackIds: ["stack-1"], tags: ["decision"] }), {
      params: Promise.resolve({ id: "inbox-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.createLibraryItem).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      title: "Decision from call",
      itemType: "decision",
      stackIds: ["stack-1"],
      source: expect.objectContaining({
        sourceKind: "inbox",
        externalId: "inbox-1",
      }),
    }));
  });

  it("assigns an existing Inbox context item to selected Stacks", async () => {
    const inboxChain = chain({
      data: {
        id: "inbox-1",
        title: "Existing context",
        body: null,
        type: "new_context",
        priority: "normal",
        source_type: "upload",
        source_url: null,
        context_item_id: "ctx-existing",
        user_id: "user-1",
      },
      error: null,
    });
    mocks.from.mockReturnValue(inboxChain);

    const response = await POST(request({ stackIds: ["stack-1"] }), {
      params: Promise.resolve({ id: "inbox-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.createLibraryItem).not.toHaveBeenCalled();
    expect(mocks.assignLibraryItemToStacks).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      itemId: "ctx-existing",
      stackIds: ["stack-1"],
    }));
  });
});
