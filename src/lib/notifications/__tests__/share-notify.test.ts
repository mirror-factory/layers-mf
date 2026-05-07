import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyShare } from "../share-notify";

// Mock the Supabase admin client
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

describe("notifyShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: profile lookup returns a name
    mockSingle.mockResolvedValue({
      data: { full_name: "Alice Smith", email: "alice@example.com" },
      error: null,
    });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockInsert.mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return { select: mockSelect };
      }
      if (table === "notifications") {
        return { insert: mockInsert };
      }
      return {};
    });
  });

  it("creates a notification with correct fields", async () => {
    await notifyShare({
      sharedBy: "user-1",
      sharedWithUserId: "user-2",
      resourceType: "artifact",
      resourceId: "art-1",
      resourceTitle: "My Dashboard",
      orgId: "org-1",
    });

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockFrom).toHaveBeenCalledWith("notifications");

    expect(mockInsert).toHaveBeenCalledWith({
      org_id: "org-1",
      user_id: "user-2",
      type: "content_shared",
      title: "Alice Smith shared a artifact with you",
      body: "My Dashboard",
      link: "/artifacts/art-1",
      metadata: {
        shared_by: "user-1",
        resource_type: "artifact",
        resource_id: "art-1",
      },
    });
  });

  it("uses email as fallback when full_name is missing", async () => {
    mockSingle.mockResolvedValue({
      data: { full_name: null, email: "bob@example.com" },
      error: null,
    });

    await notifyShare({
      sharedBy: "user-1",
      sharedWithUserId: "user-2",
      resourceType: "context_item",
      resourceId: "ctx-1",
      resourceTitle: "Sprint Notes",
      orgId: "org-1",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "bob@example.com shared a context_item with you",
        link: "/context/ctx-1",
      })
    );
  });

  it("uses 'Someone' when profile lookup fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    await notifyShare({
      sharedBy: "user-1",
      sharedWithUserId: "user-2",
      resourceType: "conversation",
      resourceId: "conv-1",
      resourceTitle: "Team Chat",
      orgId: "org-1",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Someone shared a conversation with you",
        link: "/chat/conv-1",
      })
    );
  });

  it("generates correct link for conversation type", async () => {
    await notifyShare({
      sharedBy: "user-1",
      sharedWithUserId: "user-2",
      resourceType: "conversation",
      resourceId: "conv-1",
      resourceTitle: "Team Chat",
      orgId: "org-1",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        link: "/chat/conv-1",
      })
    );
  });

  it("generates correct link for context type (fallback)", async () => {
    await notifyShare({
      sharedBy: "user-1",
      sharedWithUserId: "user-2",
      resourceType: "document",
      resourceId: "doc-1",
      resourceTitle: "Some Doc",
      orgId: "org-1",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        link: "/context/doc-1",
      })
    );
  });

  it("never throws on error (silent failure)", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    // Should not throw
    await expect(
      notifyShare({
        sharedBy: "user-1",
        sharedWithUserId: "user-2",
        resourceType: "artifact",
        resourceId: "art-1",
        resourceTitle: "Broken",
        orgId: "org-1",
      })
    ).resolves.toBeUndefined();
  });

  it("silently handles insert rejection", async () => {
    mockInsert.mockRejectedValue(new Error("insert failed"));

    await expect(
      notifyShare({
        sharedBy: "user-1",
        sharedWithUserId: "user-2",
        resourceType: "artifact",
        resourceId: "art-1",
        resourceTitle: "Broken",
        orgId: "org-1",
      })
    ).resolves.toBeUndefined();
  });
});
