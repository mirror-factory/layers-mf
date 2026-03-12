import { describe, it, expect } from "vitest";
import { chunkDocument } from "../chunker";

describe("chunkDocument", () => {
  it("returns single chunk for short content", () => {
    const chunks = chunkDocument("Short content here.", "Test Doc");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Short content here.");
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("splits long content into multiple chunks", () => {
    // ~2000 chars = should produce 2+ chunks at 1600 char target
    const longContent = "word ".repeat(400);
    const chunks = chunkDocument(longContent, "Long Doc");
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("parent_content is larger than content", () => {
    const longContent = "word ".repeat(400);
    const chunks = chunkDocument(longContent, "Long Doc");
    for (const chunk of chunks) {
      expect(chunk.parentContent.length).toBeGreaterThanOrEqual(
        chunk.content.length
      );
    }
  });

  it("chunks have sequential indexes", () => {
    const longContent = "word ".repeat(400);
    const chunks = chunkDocument(longContent, "Long Doc");
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it("includes document title in parent_content", () => {
    const chunks = chunkDocument(
      "Some content about marketing.",
      "Marketing Report Q1"
    );
    expect(chunks[0].parentContent).toContain("Marketing Report Q1");
  });

  it("handles empty content", () => {
    const chunks = chunkDocument("", "Empty Doc");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("");
  });

  it("preserves all content across chunks", () => {
    // Generate content with distinct markers
    const sentences = Array.from(
      { length: 50 },
      (_, i) => `Sentence number ${i + 1} with unique content.`
    );
    const content = sentences.join(" ");
    const chunks = chunkDocument(content, "Full Doc");

    // Every sentence should appear in at least one chunk
    for (const sentence of sentences) {
      const found = chunks.some((c) => c.content.includes(sentence));
      expect(found).toBe(true);
    }
  });
});
