import { describe, it, expect, vi, beforeEach } from "vitest";
import { logArtifactInteraction } from "../artifact-tracker";

// Mock the Supabase admin client
const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

describe("logArtifactInteraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it("logs a basic interaction", async () => {
    await logArtifactInteraction({
      artifactId: "art-1",
      userId: "user-1",
      type: "viewed",
    });

    expect(mockFrom).toHaveBeenCalledWith("artifact_interactions");
    expect(mockInsert).toHaveBeenCalledWith({
      artifact_id: "art-1",
      user_id: "user-1",
      interaction_type: "viewed",
      metadata: {},
      chat_context: undefined,
      conversation_id: undefined,
      version_number: undefined,
    });
  });

  it("includes metadata and chat_context when provided", async () => {
    await logArtifactInteraction({
      artifactId: "art-2",
      userId: "user-2",
      type: "edited",
      metadata: { field: "title", oldValue: "Draft", newValue: "Final" },
      chatContext: "User asked to rename the artifact",
      conversationId: "conv-1",
      versionNumber: 3,
    });

    expect(mockInsert).toHaveBeenCalledWith({
      artifact_id: "art-2",
      user_id: "user-2",
      interaction_type: "edited",
      metadata: { field: "title", oldValue: "Draft", newValue: "Final" },
      chat_context: "User asked to rename the artifact",
      conversation_id: "conv-1",
      version_number: 3,
    });
  });

  it("never throws on error (silent failure)", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Database connection failed");
    });

    // Should not throw
    await expect(
      logArtifactInteraction({
        artifactId: "art-3",
        userId: "user-3",
        type: "created",
      })
    ).resolves.toBeUndefined();
  });

  it("handles insert rejection without throwing", async () => {
    mockInsert.mockRejectedValue(new Error("insert failed"));
    mockFrom.mockReturnValue({ insert: mockInsert });

    await expect(
      logArtifactInteraction({
        artifactId: "art-4",
        userId: "user-4",
        type: "deleted",
      })
    ).resolves.toBeUndefined();
  });

  it("accepts all valid interaction types", async () => {
    const types = [
      "created", "viewed", "edited", "shared", "opened_by_recipient",
      "sandbox_executed", "ai_read", "ai_modified", "forked",
      "restored", "deleted", "tagged", "commented",
    ] as const;

    for (const type of types) {
      vi.clearAllMocks();
      mockInsert.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await logArtifactInteraction({
        artifactId: "art-all",
        userId: "user-all",
        type,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ interaction_type: type })
      );
    }
  });

  it("defaults metadata to empty object when not provided", async () => {
    await logArtifactInteraction({
      artifactId: "art-5",
      userId: "user-5",
      type: "forked",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} })
    );
  });
});
