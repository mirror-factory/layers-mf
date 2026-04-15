import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI SDK generateObject
const mockGenerateObject = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

// Mock the gateway config
vi.mock("@/lib/ai/config", () => ({
  gateway: (model: string) => ({ modelId: model }),
}));

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-1234",
});

import { checkForAmbientSuggestion } from "../ambient-check";

describe("checkForAmbientSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when fewer than 2 messages", async () => {
    const result = await checkForAmbientSuggestion({
      recentMessages: [{ role: "user", text: "Hello" }],
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result).toBeNull();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns null when all messages are from same role", async () => {
    const result = await checkForAmbientSuggestion({
      recentMessages: [
        { role: "user", text: "Hello" },
        { role: "user", text: "Anyone there?" },
      ],
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result).toBeNull();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns null when should_suggest is false", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        should_suggest: false,
      },
    });

    const result = await checkForAmbientSuggestion({
      recentMessages: [
        { role: "user", text: "Hello" },
        { role: "assistant", text: "Hi there!" },
      ],
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when should_suggest is true but title is missing", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        should_suggest: true,
        title: undefined,
        body: "Some body text",
      },
    });

    const result = await checkForAmbientSuggestion({
      recentMessages: [
        { role: "user", text: "Hello" },
        { role: "assistant", text: "Hi there!" },
      ],
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result).toBeNull();
  });

  it("returns suggestion with correct fields when should_suggest is true", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        should_suggest: true,
        suggestion_type: "action",
        title: "Create a task",
        body: "It seems like you discussed a follow-up item.",
      },
    });

    const result = await checkForAmbientSuggestion({
      recentMessages: [
        { role: "user", text: "We need to update the docs" },
        { role: "assistant", text: "Good point, that should be tracked" },
      ],
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result).toEqual({
      id: "test-uuid-1234",
      type: "action",
      title: "Create a task",
      body: "It seems like you discussed a follow-up item.",
      actions: ["accept", "dismiss", "modify"],
    });
  });

  it("defaults suggestion_type to info when not provided", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        should_suggest: true,
        title: "Useful context",
        body: "Here is some relevant information.",
      },
    });

    const result = await checkForAmbientSuggestion({
      recentMessages: [
        { role: "user", text: "What about the budget?" },
        { role: "assistant", text: "Let me look into that." },
      ],
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe("info");
  });

  it("defaults body to empty string when not provided", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        should_suggest: true,
        suggestion_type: "question",
        title: "Clarification needed",
      },
    });

    const result = await checkForAmbientSuggestion({
      recentMessages: [
        { role: "user", text: "We should deploy soon" },
        { role: "assistant", text: "Which environment?" },
      ],
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result).not.toBeNull();
    expect(result!.body).toBe("");
  });

  it("sends only the last 5 messages as transcript", async () => {
    mockGenerateObject.mockResolvedValue({
      object: { should_suggest: false },
    });

    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      text: `Message ${i}`,
    }));

    await checkForAmbientSuggestion({
      recentMessages: messages,
      orgId: "org-1",
      conversationId: "conv-1",
    });

    const call = mockGenerateObject.mock.calls[0][0];
    const prompt = call.prompt as string;
    // Should contain messages 5-9 (last 5), not messages 0-4
    expect(prompt).toContain("Message 5");
    expect(prompt).toContain("Message 9");
    expect(prompt).not.toContain("Message 0");
    expect(prompt).not.toContain("Message 4");
  });

  it("handles generateObject errors gracefully", async () => {
    mockGenerateObject.mockRejectedValue(new Error("API error"));

    await expect(
      checkForAmbientSuggestion({
        recentMessages: [
          { role: "user", text: "Hello" },
          { role: "assistant", text: "Hi" },
        ],
        orgId: "org-1",
        conversationId: "conv-1",
      })
    ).rejects.toThrow("API error");
  });
});
