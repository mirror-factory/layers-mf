export interface Chunk {
  chunkIndex: number;
  content: string;
  parentContent: string;
  metadata: Record<string, unknown>;
}

const CHILD_SIZE = 1600; // ~400 tokens
const PARENT_SIZE = 6000; // ~1500 tokens
const OVERLAP = 200; // ~50 tokens overlap between children

/**
 * Split a document into parent-child chunks.
 * Child chunks (~400 tokens) are used for vector search.
 * Parent chunks (~1500 tokens) are returned to the LLM as context.
 */
export function chunkDocument(rawContent: string, title: string): Chunk[] {
  if (rawContent.length <= CHILD_SIZE) {
    return [
      {
        chunkIndex: 0,
        content: rawContent,
        parentContent: `[Document: ${title}]\n\n${rawContent}`,
        metadata: { title },
      },
    ];
  }

  const chunks: Chunk[] = [];
  let offset = 0;
  let index = 0;

  while (offset < rawContent.length) {
    // Find child boundary (try to break at sentence/paragraph)
    let end = Math.min(offset + CHILD_SIZE, rawContent.length);
    if (end < rawContent.length) {
      const breakPoint = findBreakPoint(
        rawContent,
        offset + CHILD_SIZE - 200,
        end + 100
      );
      if (breakPoint > offset) end = breakPoint;
    }

    const content = rawContent.slice(offset, end).trim();
    if (content.length === 0) break;

    // Parent window: expand around the child chunk
    const parentStart = Math.max(0, offset - (PARENT_SIZE - CHILD_SIZE) / 2);
    const parentEnd = Math.min(rawContent.length, parentStart + PARENT_SIZE);
    const parentContent = `[Document: ${title}]\n\n${rawContent.slice(parentStart, parentEnd).trim()}`;

    chunks.push({
      chunkIndex: index,
      content,
      parentContent,
      metadata: { title, charOffset: offset },
    });

    // Advance offset; ensure forward progress to avoid infinite loop
    const nextOffset = end - OVERLAP;
    if (nextOffset <= offset) break; // remaining content fits in overlap, we're done
    offset = nextOffset;
    if (offset >= rawContent.length) break;
    index++;
  }

  return chunks;
}

function findBreakPoint(text: string, start: number, end: number): number {
  const region = text.slice(start, end);

  const paraBreak = region.lastIndexOf("\n\n");
  if (paraBreak > 0) return start + paraBreak + 2;

  const sentenceBreak = region.lastIndexOf(". ");
  if (sentenceBreak > 0) return start + sentenceBreak + 2;

  const wordBreak = region.lastIndexOf(" ");
  if (wordBreak > 0) return start + wordBreak + 1;

  return end;
}
