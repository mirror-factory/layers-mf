import { describe, it, expect } from "vitest";
import { mapNangoRecord } from "../nango-mappers";

describe("mapNangoRecord", () => {
  // ── Google Drive ────────────────────────────────────────────────────────

  describe("google-drive", () => {
    it("maps a Google Drive document record", () => {
      const result = mapNangoRecord("google-drive", {
        id: "file-123",
        name: "Project Brief.docx",
        content: "This is the project brief with enough content to pass the minimum length threshold for mapping.",
        mimeType: "application/vnd.google-apps.document",
        createdTime: "2026-01-15T10:00:00Z",
        modifiedTime: "2026-02-01T14:30:00Z",
        webViewLink: "https://docs.google.com/document/d/file-123/edit",
        lastModifyingUser: { displayName: "Alfonso" },
      });

      expect(result).not.toBeNull();
      expect(result!.source_id).toBe("file-123");
      expect(result!.title).toBe("Project Brief.docx");
      expect(result!.content_type).toBe("document");
      expect(result!.source_created_at).toBe("2026-01-15T10:00:00Z");
      expect(result!.source_metadata).toEqual({
        mimeType: "application/vnd.google-apps.document",
        webViewLink: "https://docs.google.com/document/d/file-123/edit",
        modifiedTime: "2026-02-01T14:30:00Z",
        lastModifiedBy: "Alfonso",
      });
    });

    it("uses exportedContent field when content is absent", () => {
      const result = mapNangoRecord("google-drive", {
        id: "file-456",
        name: "Spreadsheet",
        exportedContent: "Row1,Col1,Col2\nData,A,B\nMore data here to exceed the minimum character threshold.",
        mimeType: "text/csv",
      });

      expect(result).not.toBeNull();
      expect(result!.raw_content).toContain("Row1,Col1,Col2");
    });

    it("returns null for empty content", () => {
      const result = mapNangoRecord("google-drive", {
        id: "file-789",
        name: "Empty.txt",
        content: "",
      });

      expect(result).toBeNull();
    });

    it("returns null for content shorter than 30 chars", () => {
      const result = mapNangoRecord("google-drive", {
        id: "file-short",
        name: "Short.txt",
        content: "Too short",
      });

      expect(result).toBeNull();
    });
  });

  // ── Linear ──────────────────────────────────────────────────────────────

  describe("linear", () => {
    it("maps a Linear issue with full metadata", () => {
      const result = mapNangoRecord("linear", {
        id: "issue-abc",
        identifier: "PROD-42",
        title: "Fix onboarding flow",
        description: "The onboarding flow breaks when users skip the profile step. We need to handle that case gracefully.",
        state: { name: "In Progress" },
        assignee: { name: "Alfonso" },
        priority: 2,
        labels: { nodes: [{ name: "bug" }, { name: "frontend" }] },
        createdAt: "2026-03-01T09:00:00Z",
      });

      expect(result).not.toBeNull();
      expect(result!.source_id).toBe("issue-abc");
      expect(result!.title).toBe("PROD-42: Fix onboarding flow");
      expect(result!.content_type).toBe("issue");
      expect(result!.raw_content).toContain("onboarding flow breaks");
      expect(result!.raw_content).toContain("Status: In Progress");
      expect(result!.raw_content).toContain("Assignee: Alfonso");
      expect(result!.raw_content).toContain("Priority: High");
      expect(result!.raw_content).toContain("Labels: bug, frontend");
      expect(result!.source_metadata).toMatchObject({
        identifier: "PROD-42",
        state: "In Progress",
        assignee: "Alfonso",
        labels: ["bug", "frontend"],
      });
    });

    it("maps a Linear issue without identifier", () => {
      const result = mapNangoRecord("linear", {
        id: "issue-def",
        title: "Untitled task",
        description: "Some description that is long enough to pass the minimum length check for the mapper.",
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Untitled task");
    });

    it("returns null for short description", () => {
      const result = mapNangoRecord("linear", {
        id: "issue-short",
        title: "Short",
        description: "tiny",
      });

      expect(result).toBeNull();
    });
  });

  // ── Slack ─────────────────────────────────────────────────────────────

  describe("slack", () => {
    it("maps a Slack record with messages array", () => {
      const result = mapNangoRecord("slack", {
        id: "slack-channel-1",
        channel_name: "general",
        messages: [
          { text: "Hey team, just pushed the new feature to staging for review", user: "alfonso" },
          { text: "Looks great, I will review it this afternoon and leave comments", user: "dev2" },
        ],
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("#general — recent messages");
      expect(result!.content_type).toBe("message");
      expect(result!.raw_content).toContain("[alfonso]");
      expect(result!.raw_content).toContain("pushed the new feature");
    });

    it("maps a Slack record with pre-batched content", () => {
      const result = mapNangoRecord("slack", {
        id: "slack-channel-2",
        channel_name: "engineering",
        content: "Pre-batched content from Nango sync that has enough characters to pass the threshold.",
      });

      expect(result).not.toBeNull();
      expect(result!.raw_content).toContain("Pre-batched content");
    });

    it("returns null for empty messages", () => {
      const result = mapNangoRecord("slack", {
        id: "slack-empty",
        channel_name: "quiet",
        messages: [],
      });

      expect(result).toBeNull();
    });
  });

  // ── Discord ───────────────────────────────────────────────────────────

  describe("discord", () => {
    it("maps a Discord record with messages", () => {
      const result = mapNangoRecord("discord", {
        id: "discord-channel-100",
        channel_name: "dev-chat",
        guild_name: "Mirror Factory",
        messages: [
          {
            content: "Just deployed the latest build to production and everything looks clean",
            author: { username: "alfonso", bot: false },
            timestamp: "2026-03-15T10:00:00Z",
          },
          {
            content: "Bot notification: deploy complete",
            author: { username: "deploy-bot", bot: true },
          },
          {
            content: "Nice work! The dashboard loads much faster now after the optimization",
            author: { username: "dev2", bot: false },
          },
        ],
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("#dev-chat — Mirror Factory");
      expect(result!.content_type).toBe("message");
      // Bot messages should be filtered out
      expect(result!.raw_content).not.toContain("deploy-bot");
      expect(result!.raw_content).toContain("[alfonso]");
    });

    it("returns null if only bot messages", () => {
      const result = mapNangoRecord("discord", {
        id: "discord-bots",
        channel_name: "alerts",
        guild_name: "Server",
        messages: [
          { content: "Alert fired", author: { username: "bot", bot: true } },
        ],
      });

      expect(result).toBeNull();
    });
  });

  // ── GitHub ────────────────────────────────────────────────────────────

  describe("github", () => {
    it("maps a GitHub issue record", () => {
      const result = mapNangoRecord("github", {
        id: "gh-issue-1",
        repo_name: "layers-mf",
        title: "Add webhook handler for Nango sync events",
        body: "We need to handle incoming sync webhooks from Nango so that records flow into our pipeline automatically.",
        state: "open",
        labels: [{ name: "enhancement" }, { name: "backend" }],
        created_at: "2026-03-10T08:00:00Z",
        number: 42,
        html_url: "https://github.com/mirror-factory/layers-mf/issues/42",
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("[layers-mf] Add webhook handler for Nango sync events");
      expect(result!.content_type).toBe("issue");
      expect(result!.raw_content).toContain("State: open");
      expect(result!.raw_content).toContain("Labels: enhancement, backend");
      expect(result!.source_metadata).toMatchObject({
        repoName: "layers-mf",
        state: "open",
        number: 42,
      });
    });

    it("maps a GitHub issue without repo name", () => {
      const result = mapNangoRecord("github", {
        id: "gh-issue-2",
        title: "Standalone issue title",
        body: "Body content that is long enough to pass the minimum character threshold for mapping records.",
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Standalone issue title");
    });

    it("returns null for issue with no body", () => {
      const result = mapNangoRecord("github", {
        id: "gh-issue-empty",
        title: "No body",
        body: "",
      });

      expect(result).toBeNull();
    });
  });

  // ── Granola ───────────────────────────────────────────────────────────

  describe("granola", () => {
    it("maps a Granola meeting record", () => {
      const result = mapNangoRecord("granola", {
        id: "meeting-xyz",
        title: "Weekly standup",
        transcript: "Alfonso: Let's go over the sprint. We shipped the webhook handler and the mapper tests. Dev2: I finished the billing page.",
        created_at: "2026-03-14T15:00:00Z",
        attendees: [
          { name: "Alfonso", email: "alfonso@example.com" },
          { name: "Dev2", email: "dev2@example.com" },
        ],
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Weekly standup");
      expect(result!.content_type).toBe("meeting_transcript");
      expect(result!.raw_content).toContain("Attendees: Alfonso, Dev2");
      expect(result!.source_metadata).toEqual({ attendees: ["Alfonso", "Dev2"] });
    });

    it("returns null for short transcript", () => {
      const result = mapNangoRecord("granola", {
        id: "meeting-short",
        title: "Quick sync",
        transcript: "Hi",
      });

      expect(result).toBeNull();
    });
  });

  // ── Generic / unknown provider ────────────────────────────────────────

  describe("unknown provider", () => {
    it("uses generic mapper for unknown providers", () => {
      const result = mapNangoRecord("notion", {
        id: "page-1",
        title: "My Notion Page",
        content: "This is enough content from Notion to pass the minimum character threshold for the generic mapper.",
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("My Notion Page");
      expect(result!.content_type).toBe("document");
    });

    it("returns null for unknown provider with short content", () => {
      const result = mapNangoRecord("notion", {
        id: "page-2",
        title: "Empty",
        content: "x",
      });

      expect(result).toBeNull();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("truncates content to 12000 chars", () => {
      const longContent = "x".repeat(15_000);
      const result = mapNangoRecord("google-drive", {
        id: "long-file",
        name: "Big File",
        content: longContent,
      });

      expect(result).not.toBeNull();
      expect(result!.raw_content.length).toBe(12_000);
    });

    it("handles missing id gracefully", () => {
      const result = mapNangoRecord("google-drive", {
        name: "No ID File",
        content: "Content that is long enough to pass the minimum character threshold for mapping.",
      });

      expect(result).not.toBeNull();
      expect(result!.source_id).toBe("");
    });

    it("handles null fields without crashing", () => {
      const result = mapNangoRecord("linear", {
        id: "null-fields",
        title: null,
        description: "Description with enough content to pass the threshold and be properly mapped.",
        state: null,
        assignee: null,
        labels: null,
      });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Untitled");
    });
  });
});
