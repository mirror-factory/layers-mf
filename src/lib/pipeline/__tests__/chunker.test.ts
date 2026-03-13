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

  it("preserves code blocks in markdown content", () => {
    const markdown = [
      "# Getting Started",
      "",
      "Here is an example:",
      "",
      "```typescript",
      "function hello(name: string): string {",
      "  return `Hello, ${name}!`;",
      "}",
      "```",
      "",
      "And more text after the code block.",
    ].join("\n");

    const chunks = chunkDocument(markdown, "Markdown Doc");
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // The code fence markers should be preserved in the content
    const allContent = chunks.map((c) => c.content).join(" ");
    expect(allContent).toContain("```typescript");
    expect(allContent).toContain("```");
    expect(allContent).toContain("function hello");
  });

  it("splits very long single-line content", () => {
    // 5000 chars on one line, no spaces — forces raw boundary split
    const longLine = "a".repeat(5000);
    const chunks = chunkDocument(longLine, "Long Line");
    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk should contain only 'a' characters
    for (const chunk of chunks) {
      expect(chunk.content).toMatch(/^a+$/);
    }

    // Total content length (without overlap dedup) should cover original
    // With overlap, combined lengths will exceed original, but each chunk should be non-empty
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.content.length).toBeLessThanOrEqual(5000);
    }
  });

  it("handles unicode content (CJK, emoji)", () => {
    // Short unicode content — should remain a single chunk
    const unicode = "这是一个测试文档。🎉🚀 日本語テスト。한국어 테스트.";
    const chunks = chunkDocument(unicode, "Unicode Doc");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(unicode);
    expect(chunks[0].parentContent).toContain("Unicode Doc");

    // Long unicode content — should chunk correctly
    const longUnicode = "日本語のテスト文。".repeat(300); // ~2700 chars
    const longChunks = chunkDocument(longUnicode, "Long Unicode");
    expect(longChunks.length).toBeGreaterThan(1);
    for (const chunk of longChunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("handles content with only whitespace", () => {
    const whitespace = "   \n\n\t  \n  ";
    const chunks = chunkDocument(whitespace, "Whitespace Doc");
    // Content gets trimmed, so either empty single chunk or no chunks
    // Based on implementation: length <= CHILD_SIZE so single chunk, content is trimmed
    expect(chunks).toHaveLength(1);
  });

  it("handles content with many consecutive newlines", () => {
    const content = "Paragraph one.\n\n\n\n\n\n\n\nParagraph two.\n\n\n\n\n\nParagraph three.";
    const chunks = chunkDocument(content, "Newlines Doc");
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const allContent = chunks.map((c) => c.content).join(" ");
    expect(allContent).toContain("Paragraph one.");
    expect(allContent).toContain("Paragraph two.");
    expect(allContent).toContain("Paragraph three.");
  });

  it("handles content exactly at chunk boundary size (1600 chars)", () => {
    // Exactly CHILD_SIZE characters — should be a single chunk
    const exact = "x".repeat(1600);
    const chunks = chunkDocument(exact, "Exact Boundary");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(exact);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("handles content one char over chunk boundary (1601 chars)", () => {
    // Just over CHILD_SIZE — should produce multiple chunks
    const overBy1 = "x".repeat(1601);
    const chunks = chunkDocument(overBy1, "Over Boundary");
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("handles long markdown with multiple code blocks", () => {
    // Generate enough sections to exceed CHILD_SIZE (1600 chars)
    const sections = Array.from({ length: 30 }, (_, i) => [
      `## Section ${i + 1}`,
      "",
      `Description for section ${i + 1} with enough text to make this section substantial and meaningful for chunking purposes.`,
      "",
      "```javascript",
      `const value${i} = ${i * 10};`,
      `console.log("Section ${i + 1}:", value${i});`,
      `// Additional comment to add length to section ${i + 1}`,
      "```",
      "",
    ].join("\n"));
    const content = sections.join("\n");
    // Verify content is long enough to chunk
    expect(content.length).toBeGreaterThan(1600);

    const chunks = chunkDocument(content, "Multi Code Blocks");

    expect(chunks.length).toBeGreaterThan(1);
    // All sections should appear somewhere in the chunks
    for (let i = 0; i < 30; i++) {
      const found = chunks.some((c) => c.content.includes(`Section ${i + 1}`));
      expect(found).toBe(true);
    }
  });
});
