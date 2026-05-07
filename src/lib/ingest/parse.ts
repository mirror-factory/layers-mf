import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type ParsedFile = {
  text: string;
  contentType: "document" | "meeting_transcript";
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let text: string;

  if (name.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    text = result.text;
  } else if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    text = buffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  // Heuristic: files with transcript-like patterns are meeting_transcript
  const transcriptPattern = /\b(speaker|attendee|transcript|\d{1,2}:\d{2}(:\d{2})?)\b/i;
  const contentType = transcriptPattern.test(text.slice(0, 500))
    ? "meeting_transcript"
    : "document";

  return { text: text.trim(), contentType };
}
