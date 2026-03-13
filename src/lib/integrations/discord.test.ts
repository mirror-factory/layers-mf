import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNangoProxy } = vi.hoisted(() => ({
  mockNangoProxy: vi.fn(),
}));

vi.mock("@/lib/nango/client", () => ({
  nango: { proxy: mockNangoProxy },
}));

import {
  fetchDiscordGuilds,
  fetchDiscordChannels,
  fetchDiscordMessages,
  batchMessagesToContent,
  buildChannelMetadata,
  buildMessageMetadata,
  verifyDiscordSignature,
  type DiscordMessage,
} from "./discord";

// ── fetchDiscordGuilds ───────────────────────────────────────────────────────

describe("fetchDiscordGuilds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches guilds from Discord API via Nango proxy", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: [
        { id: "g-1", name: "Test Server", icon: null },
        { id: "g-2", name: "Dev Server", icon: "icon-hash" },
      ],
    });

    const guilds = await fetchDiscordGuilds("conn-1", "discord");
    expect(guilds).toHaveLength(2);
    expect(guilds[0].name).toBe("Test Server");
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/users/@me/guilds",
        providerConfigKey: "discord",
        connectionId: "conn-1",
      })
    );
  });

  it("returns empty array on API error", async () => {
    mockNangoProxy.mockRejectedValueOnce(new Error("Discord API error"));
    const guilds = await fetchDiscordGuilds("conn-1", "discord");
    expect(guilds).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    mockNangoProxy.mockResolvedValueOnce({ data: null });
    const guilds = await fetchDiscordGuilds("conn-1", "discord");
    expect(guilds).toEqual([]);
  });
});

// ── fetchDiscordChannels ─────────────────────────────────────────────────────

describe("fetchDiscordChannels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches and filters text channels", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: [
        { id: "ch-1", name: "general", type: 0, guild_id: "g-1", parent_id: null, topic: null },
        { id: "ch-2", name: "voice", type: 2, guild_id: "g-1", parent_id: null, topic: null },
        { id: "ch-3", name: "announcements", type: 5, guild_id: "g-1", parent_id: null, topic: null },
      ],
    });

    const channels = await fetchDiscordChannels("conn-1", "discord", "g-1");
    // type 0 (text) and type 5 (announcement) are included; type 2 (voice) is excluded
    expect(channels).toHaveLength(2);
    expect(channels.map((c) => c.name)).toContain("general");
    expect(channels.map((c) => c.name)).toContain("announcements");
  });

  it("returns empty array on error", async () => {
    mockNangoProxy.mockRejectedValueOnce(new Error("Forbidden"));
    const channels = await fetchDiscordChannels("conn-1", "discord", "g-1");
    expect(channels).toEqual([]);
  });
});

// ── fetchDiscordMessages ─────────────────────────────────────────────────────

describe("fetchDiscordMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches messages with default limit", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: [
        {
          id: "m-1",
          channel_id: "ch-1",
          author: { id: "u-1", username: "user1", global_name: null },
          content: "Hello world",
          timestamp: "2026-03-01T10:00:00Z",
        },
      ],
    });

    const messages = await fetchDiscordMessages("conn-1", "discord", "ch-1");
    expect(messages).toHaveLength(1);
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/channels/ch-1/messages",
        params: { limit: "100" },
      })
    );
  });

  it("passes custom limit and after parameters", async () => {
    mockNangoProxy.mockResolvedValueOnce({ data: [] });

    await fetchDiscordMessages("conn-1", "discord", "ch-1", {
      limit: 50,
      after: "msg-last",
    });
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { limit: "50", after: "msg-last" },
      })
    );
  });

  it("returns empty array on error", async () => {
    mockNangoProxy.mockRejectedValueOnce(new Error("Not Found"));
    const messages = await fetchDiscordMessages("conn-1", "discord", "ch-1");
    expect(messages).toEqual([]);
  });
});

// ── batchMessagesToContent ───────────────────────────────────────────────────

describe("batchMessagesToContent", () => {
  it("returns empty string for no messages", () => {
    expect(batchMessagesToContent([], "general", "Test Server")).toBe("");
  });

  it("builds content with header and sorted messages", () => {
    const messages: DiscordMessage[] = [
      {
        id: "m-2",
        channel_id: "ch-1",
        author: { id: "u-1", username: "alice", global_name: "Alice" },
        content: "Second message",
        timestamp: "2026-03-01T10:05:00Z",
      },
      {
        id: "m-1",
        channel_id: "ch-1",
        author: { id: "u-2", username: "bob", global_name: null },
        content: "First message",
        timestamp: "2026-03-01T10:00:00Z",
      },
    ];

    const content = batchMessagesToContent(messages, "general", "Test Server");
    expect(content).toContain("Discord — #general in Test Server");
    expect(content).toContain("Messages: 2");
    expect(content).toContain("Alice: Second message");
    expect(content).toContain("bob: First message");
    // Ensure chronological order (first message before second)
    const firstIdx = content.indexOf("First message");
    const secondIdx = content.indexOf("Second message");
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("uses username when global_name is null", () => {
    const messages: DiscordMessage[] = [
      {
        id: "m-1",
        channel_id: "ch-1",
        author: { id: "u-1", username: "fallback_user", global_name: null },
        content: "Test message",
        timestamp: "2026-03-01T10:00:00Z",
      },
    ];

    const content = batchMessagesToContent(messages, "general", "Server");
    expect(content).toContain("fallback_user: Test message");
  });

  it("skips messages with empty content", () => {
    const messages: DiscordMessage[] = [
      {
        id: "m-1",
        channel_id: "ch-1",
        author: { id: "u-1", username: "user", global_name: null },
        content: "",
        timestamp: "2026-03-01T10:00:00Z",
      },
      {
        id: "m-2",
        channel_id: "ch-1",
        author: { id: "u-2", username: "user2", global_name: null },
        content: "Actual message",
        timestamp: "2026-03-01T10:01:00Z",
      },
    ];

    const content = batchMessagesToContent(messages, "general", "Server");
    expect(content).toContain("Actual message");
    expect(content).not.toContain("user:");
  });

  it("truncates content to 12000 characters", () => {
    const messages: DiscordMessage[] = Array.from({ length: 200 }, (_, i) => ({
      id: `m-${i}`,
      channel_id: "ch-1",
      author: { id: "u-1", username: "user", global_name: null },
      content: "A".repeat(100),
      timestamp: `2026-03-01T${String(10 + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`,
    }));

    const content = batchMessagesToContent(messages, "general", "Server");
    expect(content.length).toBeLessThanOrEqual(12000);
  });
});

// ── buildChannelMetadata ─────────────────────────────────────────────────────

describe("buildChannelMetadata", () => {
  it("returns structured metadata", () => {
    const meta = buildChannelMetadata("ch-1", "general", "g-1", "Server", 42, "msg-last");
    expect(meta).toEqual({
      channelId: "ch-1",
      channelName: "general",
      guildId: "g-1",
      guildName: "Server",
      messageCount: 42,
      lastMessageId: "msg-last",
    });
  });
});

// ── buildMessageMetadata ─────────────────────────────────────────────────────

describe("buildMessageMetadata", () => {
  it("returns full metadata with all fields", () => {
    const meta = buildMessageMetadata({
      channelId: "ch-1",
      channelName: "general",
      guildId: "g-1",
      guildName: "Server",
      authorId: "u-1",
      authorName: "Alice",
      threadId: "t-1",
    });
    expect(meta).toEqual({
      channelId: "ch-1",
      channelName: "general",
      guildId: "g-1",
      guildName: "Server",
      authorId: "u-1",
      authorName: "Alice",
      threadId: "t-1",
    });
  });

  it("defaults optional fields to null", () => {
    const meta = buildMessageMetadata({
      channelId: "ch-1",
      authorId: "u-1",
      authorName: "Bob",
    });
    expect(meta.channelName).toBeNull();
    expect(meta.guildId).toBeNull();
    expect(meta.guildName).toBeNull();
    expect(meta.threadId).toBeNull();
  });
});

// ── verifyDiscordSignature ───────────────────────────────────────────────────

describe("verifyDiscordSignature", () => {
  it("returns false when body is empty", async () => {
    expect(await verifyDiscordSignature("", "sig", "ts", "key")).toBe(false);
  });

  it("returns false when signature is empty", async () => {
    expect(await verifyDiscordSignature("body", "", "ts", "key")).toBe(false);
  });

  it("returns false when timestamp is empty", async () => {
    expect(await verifyDiscordSignature("body", "sig", "", "key")).toBe(false);
  });

  it("returns false when publicKey is empty", async () => {
    expect(await verifyDiscordSignature("body", "sig", "ts", "")).toBe(false);
  });

  it("returns false for invalid key/signature (catches crypto errors)", async () => {
    const result = await verifyDiscordSignature("body", "badsig", "ts", "badkey");
    expect(result).toBe(false);
  });
});
