import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase admin client
const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();
const mockAdminClient = { from: mockFrom };

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockAdminClient,
}));

// Mock AI generateObject
const mockGenerateObject = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

// Mock AI config
vi.mock("@/lib/ai/config", () => ({
  extractionModel: "mock-model",
}));

// Mock usage logger
vi.mock("@/lib/ai/usage", () => ({
  logUsage: vi.fn(),
}));

import { generateDittoProfile, DEFAULT_PROFILE } from "../profile";

function makeInteractions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    interaction_type: i % 2 === 0 ? "search" : "click",
    resource_type: "context_item",
    query: i % 2 === 0 ? `query about topic ${i % 5}` : null,
    source_type: i % 3 === 0 ? "linear" : i % 3 === 1 ? "slack" : "google-drive",
    content_type: i % 2 === 0 ? "issue" : "document",
    metadata: {},
    created_at: new Date(2026, 2, 19, 9 + (i % 8), 0).toISOString(),
  }));
}

describe("generateDittoProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ data: null, error: null });
  });

  it("returns default profile when no interactions", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_interactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ditto_profiles") {
        return { upsert: mockUpsert };
      }
      return {};
    });

    const result = await generateDittoProfile("user-1", "org-1");

    expect(result).toEqual(DEFAULT_PROFILE);
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        org_id: "org-1",
        confidence: 0,
        interaction_count: 0,
      }),
      { onConflict: "user_id,org_id" }
    );
  });

  it("generates profile from interaction data", async () => {
    const interactions = makeInteractions(50);

    mockFrom.mockImplementation((table: string) => {
      if (table === "user_interactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: interactions,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ditto_profiles") {
        return { upsert: mockUpsert };
      }
      return {};
    });

    const generatedProfile = {
      interests: ["engineering", "infrastructure"],
      preferred_sources: { linear: 0.9, slack: 0.5 },
      communication_style: "casual" as const,
      detail_level: "detailed" as const,
      priority_topics: ["billing", "auth"],
      working_hours: { start: 9, end: 17 },
    };

    mockGenerateObject.mockResolvedValue({
      object: generatedProfile,
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    const result = await generateDittoProfile("user-1", "org-1");

    expect(result).toEqual(generatedProfile);
    expect(mockGenerateObject).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        org_id: "org-1",
        interests: generatedProfile.interests,
        confidence: 0.25, // 50/200
        interaction_count: 50,
      }),
      { onConflict: "user_id,org_id" }
    );
  });

  it("handles AI errors gracefully", async () => {
    const interactions = makeInteractions(10);

    mockFrom.mockImplementation((table: string) => {
      if (table === "user_interactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: interactions,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ditto_profiles") {
        return { upsert: mockUpsert };
      }
      return {};
    });

    mockGenerateObject.mockRejectedValue(new Error("AI service unavailable"));

    await expect(
      generateDittoProfile("user-1", "org-1")
    ).rejects.toThrow("AI service unavailable");
  });

  it("profile confidence increases with more interactions", async () => {
    const generatedProfile = {
      interests: ["testing"],
      preferred_sources: { linear: 1.0 },
      communication_style: "balanced" as const,
      detail_level: "moderate" as const,
      priority_topics: ["testing"],
      working_hours: { start: 9, end: 17 },
    };

    mockGenerateObject.mockResolvedValue({
      object: generatedProfile,
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    // Test with 50 interactions -> confidence 0.25
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_interactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: makeInteractions(50),
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ditto_profiles") {
        return { upsert: mockUpsert };
      }
      return {};
    });

    await generateDittoProfile("user-1", "org-1");
    const firstCall = mockUpsert.mock.calls[0][0];
    expect(firstCall.confidence).toBe(0.25);

    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ data: null, error: null });
    mockGenerateObject.mockResolvedValue({
      object: generatedProfile,
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    // Test with 200 interactions -> confidence 1.0
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_interactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: makeInteractions(200),
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ditto_profiles") {
        return { upsert: mockUpsert };
      }
      return {};
    });

    await generateDittoProfile("user-1", "org-1");
    const secondCall = mockUpsert.mock.calls[0][0];
    expect(secondCall.confidence).toBe(1.0);

    // More interactions = higher confidence
    expect(secondCall.confidence).toBeGreaterThan(firstCall.confidence);
  });
});
