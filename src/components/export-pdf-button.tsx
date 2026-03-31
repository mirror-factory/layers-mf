"use client";

/**
 * PDF export via browser print dialog.
 *
 * Opens a new window with styled HTML and triggers window.print(),
 * letting the user save as PDF without any heavy server-side library.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ExportableItem {
  title: string;
  source_type: string;
  content_type: string;
  description_long?: string | null;
  raw_content?: string | null;
  ingested_at?: string | null;
}

export function exportItemsAsPdf(items: ExportableItem[], title?: string) {
  const docTitle = title ?? "Granger Export";

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(docTitle)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; color: #1a1a1a; padding: 0 1rem; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    h2 { font-size: 1.2rem; margin-top: 2rem; }
    .item { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e5e5; }
    .meta { color: #666; font-size: 0.85rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; background: #f0f0f0; margin-right: 4px; }
    .content { white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="padding:8px 16px;margin-bottom:1rem;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff;">
    Save as PDF
  </button>
  <h1>${escapeHtml(docTitle)}</h1>
  <p class="meta">Generated ${new Date().toLocaleDateString()} &bull; ${items.length} item${items.length !== 1 ? "s" : ""}</p>
  ${items
    .map(
      (item) => `
  <div class="item">
    <h2>${escapeHtml(item.title)}</h2>
    <p class="meta">
      <span class="badge">${escapeHtml(item.source_type)}</span>
      <span class="badge">${escapeHtml(item.content_type.replace(/_/g, " "))}</span>
      ${item.ingested_at ? `&bull; ${new Date(item.ingested_at).toLocaleDateString()}` : ""}
    </p>
    ${item.description_long ? `<p>${escapeHtml(item.description_long)}</p>` : ""}
    ${item.raw_content ? `<pre class="content">${escapeHtml(item.raw_content.slice(0, 5000))}</pre>` : ""}
  </div>`,
    )
    .join("")}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
