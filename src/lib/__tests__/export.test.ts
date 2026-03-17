import { describe, it, expect } from "vitest";
import {
  contextItemToMarkdown,
  itemsToMarkdown,
  sessionToMarkdown,
} from "../export";

const baseItem = {
  title: "Q1 Planning Meeting",
  description_short: "Short summary of the meeting",
  description_long: "Full detailed summary of the quarterly planning session.",
  raw_content: "Meeting notes content here...",
  source_type: "google-drive",
  content_type: "meeting_transcript",
  entities: {
    people: ["Alice", "Bob"],
    topics: ["roadmap", "hiring"],
    decisions: ["Hire 2 engineers"],
    action_items: ["Draft job posting"],
    projects: ["Layers"],
  },
  ingested_at: "2026-03-10T14:30:00.000Z",
};

describe("contextItemToMarkdown", () => {
  it("produces valid markdown with title, source, and content", () => {
    const md = contextItemToMarkdown(baseItem);

    expect(md).toContain("# Q1 Planning Meeting");
    expect(md).toContain("**Source:** google-drive");
    expect(md).toContain("**Type:** meeting transcript");
    expect(md).toContain("**Date:** Mar 10, 2026");
    expect(md).toContain("## Summary");
    expect(md).toContain("Full detailed summary");
    expect(md).toContain("## Content");
    expect(md).toContain("Meeting notes content here");
    expect(md).toContain("---");
  });

  it("formats entities correctly", () => {
    const md = contextItemToMarkdown(baseItem);

    expect(md).toContain("## Entities");
    expect(md).toContain("**People:** Alice, Bob");
    expect(md).toContain("**Topics:** roadmap, hiring");
    expect(md).toContain("**Decisions:** Hire 2 engineers");
    expect(md).toContain("**Action Items:** Draft job posting");
    expect(md).toContain("**Projects:** Layers");
  });

  it("handles null/missing fields gracefully", () => {
    const minimal = {
      title: "Minimal Item",
      source_type: "upload",
      content_type: "document",
      ingested_at: "2026-01-01T00:00:00.000Z",
    };
    const md = contextItemToMarkdown(minimal);

    expect(md).toContain("# Minimal Item");
    expect(md).toContain("**Source:** upload");
    expect(md).not.toContain("## Summary");
    expect(md).not.toContain("## Content");
    expect(md).not.toContain("## Entities");
    expect(md).toContain("---");
  });

  it("handles null description_long and raw_content", () => {
    const item = {
      ...baseItem,
      description_long: null,
      raw_content: null,
      entities: null,
    };
    const md = contextItemToMarkdown(item);

    expect(md).toContain("# Q1 Planning Meeting");
    expect(md).not.toContain("## Summary");
    expect(md).not.toContain("## Content");
    expect(md).not.toContain("## Entities");
  });

  it("handles empty entity arrays", () => {
    const item = {
      ...baseItem,
      entities: { people: [], topics: [], decisions: [] },
    };
    const md = contextItemToMarkdown(item);

    expect(md).not.toContain("## Entities");
  });
});

describe("itemsToMarkdown", () => {
  it("combines multiple items with separators", () => {
    const items = [
      baseItem,
      {
        title: "Second Item",
        source_type: "slack",
        content_type: "message",
        ingested_at: "2026-03-11T10:00:00.000Z",
      },
    ];
    const md = itemsToMarkdown(items);

    expect(md).toContain("# Q1 Planning Meeting");
    expect(md).toContain("# Second Item");
    // Each item ends with ---
    expect(md.match(/---/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("includes title and item count when provided", () => {
    const md = itemsToMarkdown([baseItem], "My Export");

    expect(md).toContain("# My Export");
    expect(md).toContain("1 item exported");
  });

  it("pluralizes item count for multiple items", () => {
    const md = itemsToMarkdown([baseItem, baseItem], "Bulk Export");

    expect(md).toContain("2 items exported");
  });

  it("works with empty array", () => {
    const md = itemsToMarkdown([], "Empty");

    expect(md).toContain("# Empty");
    expect(md).toContain("0 items exported");
  });
});

describe("sessionToMarkdown", () => {
  const session = {
    name: "Sprint Planning",
    goal: "Align on Q2 priorities",
    status: "active",
  };

  it("includes session name and goal", () => {
    const md = sessionToMarkdown(session, [baseItem]);

    expect(md).toContain("# Session: Sprint Planning");
    expect(md).toContain("**Goal:** Align on Q2 priorities");
    expect(md).toContain("**Status:** active");
    expect(md).toContain("1 context item");
  });

  it("handles null goal", () => {
    const md = sessionToMarkdown(
      { name: "Quick Session", goal: null, status: "paused" },
      [],
    );

    expect(md).toContain("# Session: Quick Session");
    expect(md).not.toContain("**Goal:**");
    expect(md).toContain("**Status:** paused");
    expect(md).toContain("0 context items");
  });

  it("includes linked items in the output", () => {
    const md = sessionToMarkdown(session, [baseItem]);

    expect(md).toContain("# Q1 Planning Meeting");
    expect(md).toContain("**Source:** google-drive");
  });

  it("pluralizes context items count", () => {
    const md = sessionToMarkdown(session, [baseItem, baseItem]);

    expect(md).toContain("2 context items");
  });
});
