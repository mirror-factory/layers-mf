import { NextRequest } from "next/server";
import {
  ToolLoopAgent,
  createAgentUIStreamResponse,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
  tool,
} from "ai";
import { z } from "zod";
import { gateway } from "@/lib/ai/config";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split document content into ~3000-char "pages" */
function splitPages(content: string, pageSize = 3000): string[] {
  const pages: string[] = [];
  for (let i = 0; i < content.length; i += pageSize) {
    pages.push(content.slice(i, i + pageSize));
  }
  return pages.length > 0 ? pages : ["(empty document)"];
}

/** Simple keyword search returning line-number matches */
function searchDocumentContent(
  content: string,
  query: string,
  maxResults = 10
): { lineNumber: number; text: string; page: number }[] {
  const lines = content.split("\n");
  const lowerQuery = query.toLowerCase();
  const results: { lineNumber: number; text: string; page: number }[] = [];

  for (let i = 0; i < lines.length && results.length < maxResults; i++) {
    if (lines[i].toLowerCase().includes(lowerQuery)) {
      // Estimate page based on character offset
      const charOffset = lines.slice(0, i).join("\n").length;
      const page = Math.floor(charOffset / 3000) + 1;
      results.push({ lineNumber: i + 1, text: lines[i].trim(), page });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Build portal-specific tools
// ---------------------------------------------------------------------------

function createPortalTools(
  documentContent: string,
  enabledTools: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portal: Record<string, any>
) {
  const pages = splitPages(documentContent);
  const enabled = new Set(enabledTools);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  if (enabled.has("search_document")) {
    tools.search_document = tool({
      description:
        "Search the document for keywords. Returns matching lines with page numbers.",
      inputSchema: z.object({
        query: z.string().describe("The keyword or phrase to search for"),
        max_results: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .describe("Maximum results to return (default 10)"),
      }),
      execute: async ({
        query,
        max_results,
      }: {
        query: string;
        max_results?: number;
      }) => {
        const results = searchDocumentContent(
          documentContent,
          query,
          max_results ?? 10
        );
        return {
          query,
          total_matches: results.length,
          results,
        };
      },
    });
  }

  if (enabled.has("navigate_pdf")) {
    tools.navigate_pdf = tool({
      description:
        "Navigate the PDF viewer to a specific page. The client will scroll to that page.",
      inputSchema: z.object({
        page: z.number().describe("The page number to navigate to (1-based)"),
        reason: z
          .string()
          .optional()
          .describe("Brief explanation of why navigating here"),
      }),
      execute: async ({ page, reason }: { page: number; reason?: string }) => {
        const totalPages = pages.length;
        const clampedPage = Math.max(1, Math.min(page, totalPages));
        return {
          action: "navigate",
          page: clampedPage,
          total_pages: totalPages,
          reason: reason ?? `Navigating to page ${clampedPage}`,
        };
      },
    });
  }

  if (enabled.has("get_page_content")) {
    tools.get_page_content = tool({
      description:
        "Get the full text content of a specific page of the document.",
      inputSchema: z.object({
        page: z
          .number()
          .describe("The page number to retrieve (1-based)"),
      }),
      execute: async ({ page }: { page: number }) => {
        const idx = Math.max(0, Math.min(page - 1, pages.length - 1));
        return {
          page: idx + 1,
          total_pages: pages.length,
          content: pages[idx],
        };
      },
    });
  }

  if (enabled.has("render_chart")) {
    tools.render_chart = tool({
      description:
        "Render a Chart.js chart. Returns inline HTML that the client will display.",
      inputSchema: z.object({
        chart_config: z
          .string()
          .describe(
            "A JSON string of a Chart.js configuration object (type, data, options)"
          ),
        title: z.string().optional().describe("Optional chart title"),
        width: z
          .number()
          .optional()
          .describe("Chart width in pixels (default 600)"),
        height: z
          .number()
          .optional()
          .describe("Chart height in pixels (default 400)"),
      }),
      execute: async ({
        chart_config,
        title,
        width,
        height,
      }: {
        chart_config: string;
        title?: string;
        width?: number;
        height?: number;
      }) => {
        const w = width ?? 600;
        const h = height ?? 400;
        const html = `<!DOCTYPE html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:transparent;font-family:system-ui}</style>
</head><body>
${title ? `<h3 style="text-align:center;margin-bottom:8px">${title}</h3>` : ""}
<canvas id="c" width="${w}" height="${h}"></canvas>
<script>new Chart(document.getElementById('c'),${chart_config})</script>
</body></html>`;
        return { html, width: w, height: h, title };
      },
    });
  }

  if (enabled.has("web_search")) {
    tools.web_search = tool({
      description:
        "Search the web for current information to fact-check claims or find supporting data.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          const { generateText } = await import("ai");
          const result = await generateText({
            model: gateway("perplexity/sonar"),
            prompt: query,
            system:
              "Always include source URLs at the end of your response in this exact format:\n\nSources:\n- [Title](URL)\n- [Title](URL)\n\nThis is required for every response.",
          });

          const providerMeta =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.providerMetadata ?? (result as any).experimental_providerMetadata;
          const perplexityMeta = (providerMeta?.perplexity ??
            providerMeta?.["perplexity/sonar"] ??
            providerMeta?.gateway) as Record<string, unknown> | undefined;
          let citations = (perplexityMeta?.citations as string[]) ?? [];

          if (citations.length === 0 && providerMeta && typeof providerMeta === "object") {
            for (const key of Object.keys(providerMeta)) {
              const meta = providerMeta[key] as Record<string, unknown> | undefined;
              if (meta?.citations && Array.isArray(meta.citations)) {
                citations = meta.citations as string[];
                break;
              }
            }
          }

          if (citations.length === 0) {
            const urlRegex = /https?:\/\/[^\s)\]>]+/g;
            const found = result.text.match(urlRegex);
            if (found) citations = [...new Set(found)];
          }

          return {
            query,
            result: result.text,
            source: "perplexity/sonar",
            citations: citations.map((url, i) => ({ index: i + 1, url })),
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : "Search failed",
            query,
          };
        }
      },
    });
  }

  if (enabled.has("summarize_section")) {
    tools.summarize_section = tool({
      description:
        "Summarize a specific section or page range of the document.",
      inputSchema: z.object({
        start_page: z.number().describe("Start page (1-based)"),
        end_page: z.number().describe("End page (1-based, inclusive)"),
      }),
      execute: async ({
        start_page,
        end_page,
      }: {
        start_page: number;
        end_page: number;
      }) => {
        const startIdx = Math.max(0, start_page - 1);
        const endIdx = Math.min(pages.length, end_page);
        const sectionContent = pages.slice(startIdx, endIdx).join("\n");
        return {
          start_page,
          end_page: endIdx,
          total_pages: pages.length,
          content: sectionContent,
          note: "Use this content to generate a summary for the user.",
        };
      },
    });
  }

  if (enabled.has("highlight_text")) {
    tools.highlight_text = tool({
      description:
        "Highlight specific text in the PDF viewer. Returns the text and page number for the client to highlight.",
      inputSchema: z.object({
        text: z.string().describe("The exact text to highlight in the document"),
        page: z
          .number()
          .optional()
          .describe("Page number where the text is located (if known)"),
      }),
      execute: async ({ text, page }: { text: string; page?: number }) => {
        // Try to find the text and its page if not provided
        let foundPage = page;
        if (!foundPage) {
          const results = searchDocumentContent(documentContent, text, 1);
          foundPage = results.length > 0 ? results[0].page : 1;
        }
        return {
          action: "highlight",
          text,
          page: foundPage,
        };
      },
    });
  }

  // Animated annotations — AI can add visual callouts on the PDF
  if (enabled.has("add_annotation")) {
    tools.add_annotation = tool({
      description:
        "Add a visual annotation/callout to the PDF at a specific location. Use this to highlight and explain specific parts of the document visually. The annotation appears as an animated callout on the PDF.",
      inputSchema: z.object({
        page: z
          .number()
          .describe("Page number where the annotation should appear"),
        text: z
          .string()
          .describe("The text in the document to annotate (used to find position)"),
        note: z
          .string()
          .describe("The explanation or note to show in the callout"),
        type: z
          .enum(["info", "highlight", "warning", "tip"])
          .optional()
          .describe("Type of annotation (default: info)"),
      }),
      execute: async ({
        page,
        text,
        note,
        type,
      }: {
        page: number;
        text: string;
        note: string;
        type?: "info" | "highlight" | "warning" | "tip";
      }) => ({
        action: "add_annotation",
        page,
        text,
        note,
        type: type ?? "info",
      }),
    });
  }

  // Walkthrough — animated tour through document sections
  if (enabled.has("walkthrough_document")) {
    tools.walkthrough_document = tool({
      description:
        "Create an animated walkthrough of the document, highlighting key sections one by one with explanations. Use when the user asks to 'walk me through', 'give me a tour', 'explain the whole document', or 'walkthrough'.",
      inputSchema: z.object({
        sections: z
          .array(
            z.object({
              page: z.number().describe("Page number for this section"),
              title: z.string().describe("Section heading or title"),
              note: z
                .string()
                .describe(
                  "Brief explanation of what this section covers (1-2 sentences)"
                ),
            })
          )
          .describe("Ordered list of sections to walk through"),
      }),
      execute: async ({
        sections,
      }: {
        sections: { page: number; title: string; note: string }[];
      }) => ({
        action: "walkthrough",
        sections,
        total: sections.length,
      }),
    });
  }

  // Document switching — works with the portal's documents array
  const documents = (portal.documents as { id: string; title: string; context_item_id: string; is_active: boolean }[]) ?? [];
  if (documents.length > 1) {
    tools.list_documents = tool({
      description: "List all documents available in this portal. Shows which one is currently active.",
      inputSchema: z.object({}),
      execute: async () => ({
        documents: documents.map(d => ({ title: d.title, is_active: d.is_active })),
        active: documents.find(d => d.is_active)?.title ?? documents[0]?.title,
      }),
    });

    tools.switch_document = tool({
      description: "Switch the active document being viewed in the portal. The viewer will update to show the new document.",
      inputSchema: z.object({
        title: z.string().describe("Title of the document to switch to"),
      }),
      execute: async ({ title }: { title: string }) => {
        const target = documents.find(d => d.title.toLowerCase().includes(title.toLowerCase()));
        if (!target) {
          return { error: `Document "${title}" not found. Available: ${documents.map(d => d.title).join(", ")}` };
        }
        // Load the target document's content
        const admin = createAdminClient();
        const { data: item } = await (admin as ReturnType<typeof createAdminClient> & { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { single: () => Promise<{ data: { raw_content: string } | null }> } } } })
          .from("context_items")
          .select("raw_content")
          .eq("id", target.context_item_id)
          .single();

        return {
          action: "switch_document",
          title: target.title,
          context_item_id: target.context_item_id,
          content_preview: item?.raw_content?.slice(0, 500) ?? "(content not available)",
          page_count: item?.raw_content ? splitPages(item.raw_content).length : 0,
        };
      },
    });
  }

  return tools;
}

// ---------------------------------------------------------------------------
// Build system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portal: Record<string, any>,
  pageCount: number
): string {
  if (portal.system_prompt) return portal.system_prompt;

  const documents = (portal.documents as { title: string; is_active: boolean }[]) ?? [];
  const docList = documents.length > 1
    ? `\n\nAvailable documents (user can switch between them):\n${documents.map(d => `- ${d.title}${d.is_active ? " (currently viewing)" : ""}`).join("\n")}\nUse switch_document to change which document is displayed.`
    : "";

  return `You are a document assistant for ${portal.client_name ?? "the client"}. You are helping the reader understand "${portal.title}".

You have access to the full document content. When answering questions:
1. The FULL document content is below — just READ it and answer. Do NOT call search_document, get_page_content, list_documents, or switch_document. You already have everything.
2. Only use tools for ACTIONS: render_chart (to visualize data), navigate_pdf (to scroll the viewer), highlight_text (to highlight text in the PDF), add_annotation (to add visual callouts on the PDF), walkthrough_document (to give an animated tour).
3. IMPORTANT: When asked to visualize or chart anything, you MUST call the render_chart tool. NEVER write chart JSON in your text response.
4. When the user asks to "walk me through", "give me a tour", "explain the whole document", or "walkthrough", use the walkthrough_document tool. Identify 8-15 key sections, estimate a page number for each, and provide a brief 1-2 sentence explanation per section.
5. Always reference specific sections and quote relevant text.
6. Be concise but thorough.
7. NEVER call more than 3 tools per response (except walkthrough_document which counts as 1).

Document: ${portal.title}
Client: ${portal.client_name ?? "Unknown"}
Pages: ${pageCount}${docList}

Full document content:
${portal.document_content ?? "(no content loaded)"}

${(() => {
    // Include all documents' content so AI never needs to switch
    const docs = (portal.documents ?? []) as { title: string; content?: string; is_active?: boolean }[];
    const otherDocs = docs.filter(d => !d.is_active && d.content);
    if (otherDocs.length === 0) return "";
    return otherDocs.map(d => `\n--- Additional Document: ${d.title} ---\n${d.content}`).join("\n");
  })()}`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const shareToken =
    (body.share_token as string) ??
    request.headers.get("x-portal-token");

  if (!shareToken) {
    return new Response("Missing share_token", { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return new Response("Invalid messages", { status: 400 });
  }

  const uiMessages: UIMessage[] = body.messages;
  if (uiMessages.length === 0) {
    return new Response("Invalid messages", { status: 400 });
  }

  // Use admin client — portal chat is public, no auth required
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portal, error: portalError } = await (supabase as any)
    .from("document_portals")
    .select("*")
    .eq("share_token", shareToken)
    .eq("is_public", true)
    .single();

  if (portalError || !portal) {
    return new Response("Portal not found", { status: 404 });
  }

  // If portal has a context_item_id but no document_content, load it
  let documentContent = portal.document_content ?? "";
  if (!documentContent && portal.context_item_id) {
    const { data: contextItem } = await supabase
      .from("context_items")
      .select("raw_content")
      .eq("id", portal.context_item_id)
      .single();
    if (contextItem?.raw_content) {
      documentContent = contextItem.raw_content;
    }
  }

  const enabledTools = (portal.enabled_tools as string[]) ?? [
    "search_document",
    "navigate_pdf",
    "render_chart",
  ];

  // If the client sends x-active-tools, only build those tools (intersection with enabled)
  let activeToolsList = enabledTools;
  const activeToolsHeader = request.headers.get("x-active-tools");
  if (activeToolsHeader) {
    try {
      const clientTools = JSON.parse(activeToolsHeader) as string[];
      if (Array.isArray(clientTools) && clientTools.length > 0) {
        const enabledSet = new Set(enabledTools);
        activeToolsList = clientTools.filter((t) => enabledSet.has(t));
      }
    } catch {
      // Ignore malformed header, use all enabled tools
    }
  }

  const portalTools = createPortalTools(documentContent, activeToolsList, portal);

  const pages = splitPages(documentContent);
  let systemPrompt = buildSystemPrompt(portal, pages.length);

  // Read context tags from header and append to system prompt
  const portalContextHeader = request.headers.get("x-portal-context");
  if (portalContextHeader) {
    try {
      const contextTexts = JSON.parse(portalContextHeader) as string[];
      if (Array.isArray(contextTexts) && contextTexts.length > 0) {
        systemPrompt += `\n\n--- User-Highlighted Context ---\nThe user has highlighted the following text from the document. Reference these selections when relevant to the conversation:\n${contextTexts.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`;
      }
    } catch {
      // Ignore malformed context header
    }
  }

  const modelMessages = await convertToModelMessages(uiMessages);

  const modelId = portal.model ?? "google/gemini-3-flash";

  const agent = new ToolLoopAgent({
    model: gateway(modelId),
    instructions: systemPrompt,
    tools: portalTools,
    stopWhen: stepCountIs(3),
  });

  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages: uiMessages,
    onFinish: () => {},
  });

  return response;
}
