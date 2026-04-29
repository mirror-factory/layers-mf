import { describe, expect, it } from "vitest";
import {
  defaultDeweyProfile,
  describeMcpIngestionMode,
  toLibraryItem,
} from "./domain";

describe("Library domain", () => {
  it("maps context_items rows into Library Items", () => {
    const item = toLibraryItem({
      id: "ctx-1",
      org_id: "org-1",
      title: "Customer discovery notes",
      raw_content: "Interview transcript",
      summary: "A concise summary",
      library_item_type: "meeting",
      content_type: "meeting_transcript",
      source_type: "upload",
      source_id: "source-1",
      source_metadata: { filename: "notes.txt" },
      status: "ready",
      permissions: { visibility: "org" },
      library_scope: "org",
      ingested_at: "2026-04-28T12:00:00Z",
      processed_at: "2026-04-28T12:01:00Z",
    });

    expect(item).toMatchObject({
      id: "ctx-1",
      orgId: "org-1",
      title: "Customer discovery notes",
      body: "Interview transcript",
      summary: "A concise summary",
      itemType: "meeting",
      contentType: "meeting_transcript",
      sourceType: "upload",
      sourceId: "source-1",
      status: "ready",
      scope: "org",
    });
  });

  it("keeps MCP ingestion modes explicit", () => {
    expect(describeMcpIngestionMode("live_lookup")).toMatchObject({
      savesToLibrary: false,
      requiresSelection: false,
      durable: false,
    });

    expect(describeMcpIngestionMode("save_selected")).toMatchObject({
      savesToLibrary: true,
      requiresSelection: true,
      durable: false,
    });

    expect(describeMcpIngestionMode("sync_rule")).toMatchObject({
      savesToLibrary: true,
      requiresSelection: false,
      durable: true,
    });
  });

  it("creates Dewey as a system librarian profile, not a human user profile", () => {
    const profile = defaultDeweyProfile("org-1");

    expect(profile.name).toBe("Dewey");
    expect(profile.saveBehavior).toBe("suggest_then_save");
    expect(profile.approvalPolicy).toBe("risky_writes_require_approval");
    expect(profile.allowedTools).toEqual(
      expect.arrayContaining([
        "search_library",
        "add_library_item",
        "create_context_pack",
        "propose_action",
      ]),
    );
    expect(profile.memoryPolicy).toMatchObject({
      save_useful_chat: true,
      ask_before_saving_sensitive: true,
    });
  });
});
