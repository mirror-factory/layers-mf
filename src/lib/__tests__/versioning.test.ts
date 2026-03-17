import { describe, it, expect } from "vitest";
import { computeContentHash, detectChanges } from "../versioning";

describe("computeContentHash", () => {
  it("returns consistent SHA-256 hashes for the same content", () => {
    const hash1 = computeContentHash("hello world");
    const hash2 = computeContentHash("hello world");
    expect(hash1).toBe(hash2);
  });

  it("returns a 64-character hex string", () => {
    const hash = computeContentHash("test content");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns different hashes for different content", () => {
    const hash1 = computeContentHash("content A");
    const hash2 = computeContentHash("content B");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", () => {
    const hash = computeContentHash("");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("detectChanges", () => {
  const baseExisting = {
    raw_content: "original content",
    content_hash: null as string | null,
    title: "Original Title",
    source_metadata: { status: "open", assignee: "Alice" } as Record<string, unknown> | null,
  };

  it("detects content changes via hash comparison", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "updated content",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Alice" },
    });

    expect(result.changed).toBe(true);
    expect(result.contentChanged).toBe(true);
    expect(result.changeType).toBe("content_updated");
    expect(result.changedFields).toContain("raw_content");
  });

  it("detects metadata-only changes", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Bob" },
    });

    expect(result.changed).toBe(true);
    expect(result.contentChanged).toBe(false);
    expect(result.metadataChanged).toBe(true);
    expect(result.changeType).toBe("metadata_updated");
    expect(result.changedFields).toContain("source_metadata.assignee");
    expect(result.changedFields).not.toContain("raw_content");
  });

  it("detects status-only changes as status_changed", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "closed", assignee: "Alice" },
    });

    expect(result.changed).toBe(true);
    expect(result.changeType).toBe("status_changed");
    expect(result.changedFields).toEqual(["source_metadata.status"]);
  });

  it("returns no_change when nothing changed", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Alice" },
    });

    expect(result.changed).toBe(false);
    expect(result.contentChanged).toBe(false);
    expect(result.metadataChanged).toBe(false);
    expect(result.changeType).toBe("no_change");
    expect(result.changedFields).toEqual([]);
  });

  it("uses stored content_hash when available", () => {
    const hash = computeContentHash("original content");
    const existing = { ...baseExisting, content_hash: hash };

    const result = detectChanges(existing, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Alice" },
    });

    expect(result.changed).toBe(false);
  });

  it("detects change when stored content_hash mismatches incoming", () => {
    const existing = { ...baseExisting, content_hash: "stale-hash-value" };

    const result = detectChanges(existing, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Alice" },
    });

    expect(result.changed).toBe(true);
    expect(result.contentChanged).toBe(true);
  });

  it("detects title changes", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "original content",
      title: "New Title",
      source_metadata: { status: "open", assignee: "Alice" },
    });

    expect(result.changed).toBe(true);
    expect(result.metadataChanged).toBe(true);
    expect(result.changedFields).toContain("title");
  });

  it("lists all changed fields correctly", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "new content",
      title: "New Title",
      source_metadata: { status: "closed", assignee: "Bob" },
    });

    expect(result.changed).toBe(true);
    expect(result.changedFields).toContain("raw_content");
    expect(result.changedFields).toContain("title");
    expect(result.changedFields).toContain("source_metadata.status");
    expect(result.changedFields).toContain("source_metadata.assignee");
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it("handles null existing metadata vs non-null incoming", () => {
    const existing = { ...baseExisting, source_metadata: null };

    const result = detectChanges(existing, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "open" },
    });

    expect(result.changed).toBe(true);
    expect(result.metadataChanged).toBe(true);
    expect(result.changedFields).toContain("source_metadata.status");
  });

  it("handles non-null existing metadata vs null incoming", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: null,
    });

    expect(result.changed).toBe(true);
    expect(result.metadataChanged).toBe(true);
  });

  it("handles both metadata being null", () => {
    const existing = { ...baseExisting, source_metadata: null };

    const result = detectChanges(existing, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: null,
    });

    expect(result.changed).toBe(false);
  });

  it("handles empty content with stored hash", () => {
    const emptyHash = computeContentHash("");
    const existing = { ...baseExisting, raw_content: "", content_hash: emptyHash };

    const result = detectChanges(existing, {
      raw_content: "",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Alice" },
    });

    expect(result.changed).toBe(false);
  });

  it("detects change when existing has empty content and no hash", () => {
    // When raw_content is empty string (falsy) and no hash stored,
    // any incoming content (even empty) is treated as a change
    const existing = { ...baseExisting, raw_content: "", content_hash: null };

    const result = detectChanges(existing, {
      raw_content: "",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Alice" },
    });

    // existing hash resolves to null (empty string is falsy), incoming is a real hash
    expect(result.changed).toBe(true);
    expect(result.contentChanged).toBe(true);
  });

  it("handles null existing raw_content with missing content_hash", () => {
    const existing = {
      raw_content: null,
      content_hash: null,
      title: "Title",
      source_metadata: null,
    };

    const result = detectChanges(existing, {
      raw_content: "new content",
      title: "Title",
      source_metadata: null,
    });

    expect(result.changed).toBe(true);
    expect(result.contentChanged).toBe(true);
  });

  it("compares nested metadata values (arrays, objects)", () => {
    const existing = {
      ...baseExisting,
      source_metadata: { labels: ["bug", "urgent"], nested: { a: 1 } },
    };

    // Same values
    const noChange = detectChanges(existing, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { labels: ["bug", "urgent"], nested: { a: 1 } },
    });
    expect(noChange.changed).toBe(false);

    // Different array
    const arrayChanged = detectChanges(existing, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { labels: ["bug"], nested: { a: 1 } },
    });
    expect(arrayChanged.changed).toBe(true);
    expect(arrayChanged.changedFields).toContain("source_metadata.labels");
  });

  it("detects new metadata keys as changes", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "open", assignee: "Alice", priority: "high" },
    });

    expect(result.changed).toBe(true);
    expect(result.changedFields).toContain("source_metadata.priority");
  });

  it("detects removed metadata keys as changes", () => {
    const result = detectChanges(baseExisting, {
      raw_content: "original content",
      title: "Original Title",
      source_metadata: { status: "open" }, // assignee removed
    });

    expect(result.changed).toBe(true);
    expect(result.changedFields).toContain("source_metadata.assignee");
  });
});
