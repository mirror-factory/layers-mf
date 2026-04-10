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

  if (enabled.has("navigate_portal")) {
    tools.navigate_portal = tool({
      description:
        "Navigate the experience portal to a specific view or section. Use this when the user asks to see a specific document tab or topic.",
      inputSchema: z.object({
        target: z.string().describe("The tab or section identifier. E.g., 'proposal', 'scope-of-work', 'additional-docs', or a specific section inside the proposal."),
        reason: z.string().optional().describe("Brief explanation of why navigating here"),
      }),
      execute: async ({ target, reason }: { target: string; reason?: string }) => {
        return {
          action: "navigate",
          target,
          reason: reason ?? `Navigating to ${target}`,
        };
      },
    });
  }
  
  if (enabled.has("highlight_text")) {
    tools.highlight_text = tool({
      description:
        "Highlight exactly matched text on the screen for the user. Use this when pointing out a specific clause or sentence in the currently visible document.",
      inputSchema: z.object({
        text: z.string().describe("The exact text strictly matching the document to highlight"),
        reason: z.string().optional().describe("Brief explanation of the highlight"),
      }),
      execute: async ({ text, reason }: { text: string; reason?: string }) => {
        return {
          action: "highlight",
          text,
          reason: reason ?? `Highlighting referenced text`,
        };
      },
    });
  }

  if (enabled.has("render_chart")) {
    tools.render_chart = tool({
      description:
        "Render a Chart.js chart. Returns inline HTML that the client will display. IMPORTANT: The chart is shown in a small chat panel (~340px wide), so keep dimensions small.",
      inputSchema: z.object({
        chart_config: z
          .string()
          .describe(
            "A JSON string of a Chart.js configuration object (type, data, options). MUST include dark theme colors: use transparent background, white/light text, and the brand cyan (#0CE4F2) as the primary color. Use compact font sizes (10-11px). Include options.responsive=true and options.maintainAspectRatio=true."
          ),
        title: z.string().optional().describe("Optional chart title"),
        width: z
          .number()
          .optional()
          .describe("Chart width in pixels (DEPRECATED, UI handles sizing natively)"),
        height: z
          .number()
          .optional()
          .describe("Chart height in pixels (DEPRECATED)"),
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
        const w = width ?? 340;
        const h = height ?? 220;
        // Output responsive chart using flexible iframe layout
        const html = `<!DOCTYPE html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  body{margin:0;padding:4px;background:transparent;font-family:system-ui,-apple-system,sans-serif;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;}
  .container{position:relative;width:100%;height:100%;max-height:240px;display:flex;flex-direction:column;}
  canvas{flex:1;width:100% !important;height:100% !important;object-fit:contain;}
</style>
</head><body>
<div class="container">
${title ? `<h3 style="text-align:center;margin:0 0 6px;font-size:12px;color:rgba(100,100,100,0.8);font-weight:600">${title}</h3>` : ""}
<canvas id="c"></canvas>
</div>
<script>
  // Force transparent background, default text color and cyan primary
  Chart.defaults.color = 'rgba(100,100,100,0.8)';
  Chart.defaults.font.size = 10;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  var cfg = ${chart_config};
  if(!cfg.options) cfg.options = {};
  cfg.options.responsive = true;
  cfg.options.maintainAspectRatio = false;
  new Chart(document.getElementById('c'), cfg);
</script>
</body></html>`;
        return { html };
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
        "ALWAYS use this tool for ANY highlight request. Call it DIRECTLY without searching first — this tool automatically finds the text and navigates to its page. Just pass the exact phrase to highlight. Example: user says 'highlight the total price' → call highlight_text({text: 'Total: $180,000'}) directly. DO NOT call search_document or get_page_content first.",
      inputSchema: z.object({
        text: z.string().describe("The exact text to find and highlight (phrase or sentence). Pick a specific, unique phrase from the document content."),
        page: z.number().optional().describe("Optional page hint — leave empty if unknown"),
      }),
      execute: async ({ text, page }: { text: string; page?: number }) => {
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

  // Library registry + lookup tools — respect enabled set so intent-narrowing can filter them
  if (enabled.has("get_document_registry")) {
  tools.get_document_registry = tool({
    description: "Get the registry of all documents available in the document library for this portal. Returns each document's title, type, category, description, and ID. Use this to know WHICH document to look up when a user asks about topics that might be covered in a specific file.",
    inputSchema: z.object({}),
    execute: async () => {
      const { BLUEWAVE_DOCUMENTS } = await import("@/lib/bluewave-docs");
      const portalDocs = (portal.documents as { title: string; context_item_id?: string; is_active?: boolean }[]) ?? [];
      return {
        total: BLUEWAVE_DOCUMENTS.length + portalDocs.length,
        documents: [
          ...BLUEWAVE_DOCUMENTS.map(d => ({
            id: d.id,
            title: d.title,
            type: d.type,
            category: d.category,
            description: d.description,
            url: d.url,
            source: "library",
          })),
          ...portalDocs.map(d => ({
            id: d.context_item_id || d.title,
            title: d.title,
            type: "portal",
            category: "Portal Documents",
            description: d.is_active ? "Currently viewed portal document." : "Portal document",
            source: "portal",
          })),
        ],
      };
    },
  });
  }

  if (enabled.has("open_document_preview")) {
  tools.open_document_preview = tool({
    description: "Open a document from the library in the portal viewer. Use this when the user asks to open/view a specific library document. Use get_document_registry first to find the document_id.",
    inputSchema: z.object({
      document_id: z.string().describe("The document ID from the registry to open in the viewer"),
      reason: z.string().optional().describe("Why this document should be opened"),
    }),
    execute: async ({ document_id, reason }: { document_id: string; reason?: string }) => ({
      action: "open_document_preview",
      document_id,
      reason: reason ?? "Opening requested document",
    }),
  });
  }

  if (enabled.has("capture_screen")) {
  tools.capture_screen = tool({
    description: "Capture a screenshot of a specific area of the currently visible document. Use this when the user says 'look at this', 'see this part', 'the bottom right section', 'capture this area', or points to a specific region. Returns a description of what's visible in that area based on the document content.",
    inputSchema: z.object({
      region: z.enum(["full", "top-left", "top-right", "bottom-left", "bottom-right", "top-half", "bottom-half", "left-half", "right-half", "center"])
        .describe("Which region of the current page/view to capture"),
      page: z.number().optional().describe("Page number to capture (defaults to current page)"),
      description_request: z.string().optional().describe("What the user wants to know about this area"),
    }),
    execute: async ({ region, page, description_request }: { region: string; page?: number; description_request?: string }) => {
      return {
        action: "capture_screen",
        region,
        page: page ?? 1,
        description_request: description_request ?? "Describe what you see",
        note: "The client will capture this region visually. Use the document content you already have to describe what's in this area of the document.",
      };
    },
  });
  }

  if (enabled.has("lookup_document")) {
  tools.lookup_document = tool({
    description: "Look up content from a specific document in the library by its ID. Optionally filter by a search query to find relevant excerpts. Use get_document_registry first to know which document IDs are available.",
    inputSchema: z.object({
      document_id: z.string().describe("The document ID from the registry (e.g. 'proposal_bluewave_swell_docx')"),
      query: z.string().optional().describe("Optional search query to find relevant excerpts within the document"),
      max_chars: z.number().min(500).max(8000).optional().describe("Maximum characters to return (default 3000)"),
    }),
    execute: async ({ document_id, query, max_chars }: { document_id: string; query?: string; max_chars?: number }) => {
      try {
        const portalDocs = (portal.documents as { title: string; context_item_id?: string; content?: string | null }[]) ?? [];
        const portalDoc = portalDocs.find(d => d.context_item_id === document_id || d.title === document_id);
        if (portalDoc?.content) {
          return {
            document_id,
            content: portalDoc.content.slice(0, max_chars ?? 3000),
            total_chars: portalDoc.content.length,
            truncated: portalDoc.content.length > (max_chars ?? 3000),
            source: "portal",
          };
        }

        if (portalDoc?.context_item_id) {
          const admin = createAdminClient();
          const { data: item } = await (admin as ReturnType<typeof createAdminClient> & { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { single: () => Promise<{ data: { raw_content: string } | null }> } } } })
            .from("context_items")
            .select("raw_content")
            .eq("id", portalDoc.context_item_id)
            .single();

          if (item?.raw_content) {
            const limit = max_chars ?? 3000;
            return {
              document_id,
              content: item.raw_content.slice(0, limit),
              total_chars: item.raw_content.length,
              truncated: item.raw_content.length > limit,
              source: "portal",
            };
          }
        }

        const fs = await import("fs/promises");
        const path = await import("path");
        const manifestPath = path.join(process.cwd(), "public", "portal-docs", "bluewave", "_manifest.json");
        const raw = await fs.readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(raw) as Array<{ id: string; extractedText?: string; extractedHtml?: string }>;
        const doc = manifest.find(d => d.id === document_id);

        if (!doc) {
          return { error: `Document "${document_id}" not found in library. Use get_document_registry to see available IDs.` };
        }

        const text = doc.extractedText || "(no text content available)";
        const limit = max_chars ?? 3000;

        if (query) {
          const lines = text.split("\n").filter((l: string) => l.trim());
          const lowerQuery = query.toLowerCase();
          const queryWords = lowerQuery.split(/\s+/).filter((w: string) => w.length > 2);

          const scored = lines.map((line: string, idx: number) => {
            const lower = line.toLowerCase();
            const score = queryWords.filter((w: string) => lower.includes(w)).length;
            return { line, idx, score };
          }).filter((l: { line: string; idx: number; score: number }) => l.score > 0);

          scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

          if (scored.length > 0) {
            const seen = new Set<number>();
            const excerpts: string[] = [];
            let totalChars = 0;

            for (const { idx } of scored.slice(0, 10)) {
              const start = Math.max(0, idx - 2);
              const end = Math.min(lines.length - 1, idx + 3);
              if (!seen.has(start)) {
                const excerpt = lines.slice(start, end + 1).join("\n");
                seen.add(start);
                excerpts.push(excerpt);
                totalChars += excerpt.length;
                if (totalChars >= limit) break;
              }
            }

            return {
              document_id,
              query,
              excerpt_count: excerpts.length,
              content: excerpts.join("\n---\n").slice(0, limit),
            };
          }

          return { document_id, query, excerpt_count: 0, content: "(no matching content found)", note: "Try a broader query" };
        }

        return {
          document_id,
          content: text.slice(0, limit),
          total_chars: text.length,
          truncated: text.length > limit,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to load document" };
      }
    },
  });
  }

  // Compare + feedback + brief + track + bookmark — respect enabled set
  if (enabled.has("compare_documents")) {
  tools.compare_documents = tool({
    description: "Compare two documents from the library and highlight key differences, similarities, and important changes. Use when the user asks to 'compare', 'what's different', or 'how do these relate'.",
    inputSchema: z.object({
      doc_a_id: z.string().describe("ID of the first document (from get_document_registry)"),
      doc_b_id: z.string().describe("ID of the second document"),
      focus: z.string().optional().describe("Optional focus area: 'pricing', 'scope', 'timeline', 'terms', or 'all'"),
    }),
    execute: async ({ doc_a_id, doc_b_id, focus }: { doc_a_id: string; doc_b_id: string; focus?: string }) => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const manifestPath = path.join(process.cwd(), "public", "portal-docs", "bluewave", "_manifest.json");

      let docAText = "";
      let docBText = "";

      try {
        const raw = await fs.readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(raw) as Array<{ id: string; extractedText?: string }>;
        const docA = manifest.find(d => d.id === doc_a_id);
        const docB = manifest.find(d => d.id === doc_b_id);
        docAText = docA?.extractedText?.slice(0, 3000) ?? "";
        docBText = docB?.extractedText?.slice(0, 3000) ?? "";
      } catch {}

      // Also check portal documents
      const portalDocs = (portal.documents ?? []) as { title: string; content?: string | null; context_item_id?: string }[];
      if (!docAText) {
        const pd = portalDocs.find(d => d.title === doc_a_id || d.context_item_id === doc_a_id);
        if (pd?.content) docAText = pd.content.slice(0, 3000);
      }
      if (!docBText) {
        const pd = portalDocs.find(d => d.title === doc_b_id || d.context_item_id === doc_b_id);
        if (pd?.content) docBText = pd.content.slice(0, 3000);
      }

      return {
        action: "compare_documents",
        doc_a_id,
        doc_b_id,
        doc_a_preview: docAText.slice(0, 2000),
        doc_b_preview: docBText.slice(0, 2000),
        focus: focus ?? "all",
        note: "Compare these two document excerpts. Highlight: 1) Key differences in scope, pricing, timeline. 2) What's in one but not the other. 3) Any contradictions. Format as a clear comparison table or bullet points.",
      };
    },
  });
  }

  if (enabled.has("share_feedback")) {
  tools.share_feedback = tool({
    description: "Compile and share the viewer's feedback, questions, and annotations back to the document sender. Use when the user says 'share my notes', 'send feedback', or 'let them know my questions'.",
    inputSchema: z.object({
      summary: z.string().describe("Brief summary of the viewer's overall feedback"),
      questions: z.array(z.string()).optional().describe("List of questions the viewer has"),
      concerns: z.array(z.string()).optional().describe("Any concerns or issues raised"),
      approvals: z.array(z.string()).optional().describe("Sections the viewer approves of"),
    }),
    execute: async ({ summary, questions, concerns, approvals }: { summary: string; questions?: string[]; concerns?: string[]; approvals?: string[] }) => {
      return {
        action: "share_feedback",
        summary,
        questions: questions ?? [],
        concerns: concerns ?? [],
        approvals: approvals ?? [],
        note: "Feedback compiled. In a production system, this would be emailed to the document sender or saved to the portal's feedback log.",
      };
    },
  });
  }

  // Document switching — works with the portal's documents array
  const documents = (portal.documents as { id: string; title: string; context_item_id: string; is_active: boolean }[]) ?? [];
  if (documents.length > 1 && enabled.has("switch_document")) {
    tools.list_documents = tool({
      description: "List all documents available in this portal. Shows which one is currently active.",
      inputSchema: z.object({}),
      execute: async () => ({
        documents: documents.map(d => ({ title: d.title, is_active: d.is_active })),
        active: documents.find(d => d.is_active)?.title ?? documents[0]?.title,
      }),
    });

    tools.switch_document = tool({
      description: "ALWAYS use this when the user asks to go to, open, switch to, show, or navigate to a different portal document. The viewer will actually switch to the new document. Use this instead of navigate_pdf for document switching.",
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

  if (enabled.has("generate_brief")) {
  tools.generate_brief = tool({
    description: "Generate a concise executive brief summarizing all documents in the portal. Use this when the user asks for an overview, executive summary, or 'give me the highlights'. Returns key numbers, timeline, risks, and decision points.",
    inputSchema: z.object({
      focus: z.enum(["full", "budget", "timeline", "risks", "deliverables"]).optional().describe("Optional focus area for the brief"),
    }),
    execute: async ({ focus }: { focus?: string }) => {
      return {
        action: "generate_brief",
        focus: focus ?? "full",
        note: "Use the document content already in your context to generate a structured brief. Format as: Executive Summary (2-3 sentences), Key Numbers (budget, timeline, team size), Major Milestones (3-5 items), Risks/Concerns (2-3 items), Decision Points (what the reader needs to decide).",
      };
    },
  });
  }

  if (enabled.has("track_reading")) {
  tools.track_reading = tool({
    description: "Check what parts of the document the user has viewed and suggest sections they haven't read yet. Use when the user asks 'what haven't I seen?' or 'what should I look at next?'.",
    inputSchema: z.object({
      current_page: z.number().optional().describe("Current page the user is on"),
    }),
    execute: async ({ current_page }: { current_page?: number }) => {
      return {
        action: "track_reading",
        current_page: current_page ?? 1,
        total_pages: pages.length,
        note: "Based on the conversation history, suggest which sections of the document the user hasn't discussed yet. Recommend the most important unread sections first.",
      };
    },
  });
  }

  if (enabled.has("save_bookmark")) {
  tools.save_bookmark = tool({
    description: "Save a bookmark or note on a specific section of the document. The user can say 'bookmark this', 'save a note here', or 'remember this section'. Returns confirmation that the note was saved.",
    inputSchema: z.object({
      page: z.number().describe("Page number to bookmark"),
      title: z.string().describe("Short title for the bookmark"),
      note: z.string().describe("The note or comment to save"),
      section_text: z.string().optional().describe("The text of the section being bookmarked"),
    }),
    execute: async ({ page, title, note, section_text }: { page: number; title: string; note: string; section_text?: string }) => {
      return {
        action: "save_bookmark",
        page,
        title,
        note,
        section_text: section_text?.slice(0, 200),
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
  // Always-appended navigation rules — prevent AI from misusing navigate_pdf for doc switching
  const portalDocList = (portal.documents ?? []).map((d: { title: string }) => `"${d.title}"`).join(", ") || "none";
  const navigationRules = `

TOOL USAGE RULES — MANDATORY:

0. TOOL LIMIT: Call AT MOST 2 tools per response. Never call the same tool twice in one response. If you need more data, ask the user.

1. CHARTS: When the user asks to visualize, chart, graph, or display data as a chart, you MUST call render_chart ONCE with a Chart.js config. NEVER describe a chart in text. NEVER call lookup_document for chart requests — use the document content already in your context. Keywords: "chart", "graph", "visualize", "plot", "pie", "bar graph", "show me a chart of".

2. WALKTHROUGH: When the user asks for a "walkthrough", "walk me through", "tour", "guide me", or "explain the whole document", you MUST call walkthrough_document ONCE with 8-15 sections. Do NOT write a text summary. Do NOT call lookup_document.

3. NAVIGATION:
- Portal documents: ${portalDocList}
- If the user mentions any of these document names (even with "page" like "scope of work page"), you MUST call switch_document with the exact title.
- Only call navigate_pdf when the user says an EXPLICIT page number like "page 5" or "go to page 3".
- NEVER call navigate_pdf with a page number greater than the total page count.

4. HIGHLIGHT: When asked to highlight, point out, or mark text, call highlight_text with the exact text from the document.

5. BOOKMARK: When the user says "bookmark this", "save this", or "remember this", call save_bookmark immediately (don't ask for clarification).

Navigation examples:
- "show me a chart of the phases" → render_chart (not text)
- "walk me through this proposal" → walkthrough_document (not text summary)
- "go to the scope of work page" → switch_document({title: "Scope of Work — Aqueduct v2"})
- "show me the proposal" → switch_document({title: "Proposal — Swell"})
- "go to page 3" → navigate_pdf({page: 3})`;

  if (portal.system_prompt) return portal.system_prompt + navigationRules;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  const dateStr = formatter.format(now);

  const documents = (portal.documents as { title: string; is_active: boolean }[]) ?? [];
  const docList = documents.length > 1
    ? `\n\nAvailable documents (user can switch between them):\n${documents.map(d => `- ${d.title}${d.is_active ? " (currently viewing)" : ""}`).join("\n")}\nUse switch_document to change which document is displayed.`
    : "";

  const clientContext: string = portal.client_context ?? "A valued prospective client.";

  return `You are the AI document assistant for Mirror Factory, presenting this proposal to ${portal.client_name ?? "the client"}.
Today is ${dateStr} (Eastern Time).

You represent Mirror Factory and are excited about the opportunity to work with ${portal.client_name ?? "the client"}.
Be warm, professional, and enthusiastic. When discussing the proposal, emphasize the value and partnership.
Help the reader understand, navigate, and annotate the proposal and scope of work.
You can create charts, highlight text, add annotations, and guide them through the document.

About ${portal.client_name ?? "the client"}:
${clientContext}

You are helping the reader understand "${portal.title}".

You have access to the full document content. When answering questions:
1. The FULL document content is below — just READ it and answer. Do NOT call search_document, get_page_content, or list_documents — you already have everything.
2. NAVIGATION RULES — CRITICAL:
   - If the user mentions a DOCUMENT NAME, you MUST call switch_document. The word "page" in phrases like "scope of work page" refers to the DOCUMENT, not a page number.
   - Only call navigate_pdf when the user says an EXPLICIT PAGE NUMBER like "page 5", "next page", or "go to page 3".
   - Portal documents: ${(portal.documents ?? []).map((d: { title: string }) => `"${d.title}"`).join(", ") || "none"}
   - If the user's request mentions any of these document names (or partial match), call switch_document with the exact title from the list above.

   Examples:
   - "go to the scope of work page" → switch_document({title: "Scope of Work — Aqueduct v2"}) — "scope of work" is a DOC name
   - "show me the executive summary" → open_document_preview({document_id: "executive_summary_docx"})
   - "take me to the proposal" → switch_document({title: "Proposal — Swell"})
   - "go to page 3" → navigate_pdf({page: 3}) — explicit page number
3. Only use tools for ACTIONS: render_chart (visualize data), switch_document (change active document), navigate_pdf (scroll to PAGE NUMBER), highlight_text, add_annotation, walkthrough_document, open_document_preview.
3. IMPORTANT: When asked to visualize or chart anything, you MUST call the render_chart tool. NEVER write chart JSON in your text response.
   CRITICAL CHART RULES:
   - The chart displays in a SMALL chat panel (~340px wide). Use width=340, height=220.
   - Use ADAPTIVE theme colors that work on both light and dark backgrounds:
     - Background: always transparent
     - Text/labels: use rgba(100,100,100,0.8) — works on both light and dark
     - Grid lines: use rgba(128,128,128,0.15)
   - Use the brand color #0CE4F2 as primary, #0891B2 as secondary. Use rgba(12,228,242,0.3) for fills.
   - Use compact font sizes: 10px for labels, 11px for titles.
   - Set options.responsive=true, options.maintainAspectRatio=true.
   - Keep charts simple — 2-5 data points max for horizontal bar charts, 3-8 for line/pie.
4. When the user asks to "walk me through", "give me a tour", "explain the whole document", or "walkthrough", use the walkthrough_document tool. Identify 8-15 key sections, estimate a page number for each, and provide a brief 1-2 sentence explanation per section.
5. Always reference specific sections and quote relevant text.
6. Be concise but thorough.
7. NEVER call more than 3 tools per response (except walkthrough_document which counts as 1).
8. You have access to a full document library. ALWAYS call get_document_registry at the start of the conversation to know what documents are available.
9. When the user asks about a topic, PROACTIVELY use lookup_document to find relevant content from the library before answering. Don't wait for the user to ask you to look it up.
10. When the user asks to view/open/show a file from the library, call open_document_preview with its document_id.
11. The currently opened document is automatically loaded in your context. When the user switches documents, the new document content is sent to you.

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

  // Always enable all these core tools regardless of portal config
  const coreTools = [
    "search_document",
    "navigate_pdf",
    "navigate_portal",
    "highlight_text",
    "render_chart",
    "walkthrough_document",
    "add_annotation",
    "get_page_content",
    "summarize_section",
    "web_search",
    "capture_screen",
    "get_document_registry",
    "open_document_preview",
    "lookup_document",
    "switch_document",
    "compare_documents",
    "share_feedback",
    "generate_brief",
    "track_reading",
    "save_bookmark",
  ];
  const portalConfigTools = (portal.enabled_tools as string[]) ?? [];
  // Union of DB-configured + core tools (dedup)
  const enabledTools = Array.from(new Set([...coreTools, ...portalConfigTools]));

  // Client can send x-active-tools to opt INTO extra tools, but core tools are always enabled
  let activeToolsList = enabledTools;
  const activeToolsHeader = request.headers.get("x-active-tools");
  if (activeToolsHeader) {
    try {
      const clientTools = JSON.parse(activeToolsHeader) as string[];
      if (Array.isArray(clientTools) && clientTools.length > 0) {
        // Union: core tools + client-requested tools (not intersection — prevents stripping essential tools)
        activeToolsList = Array.from(new Set([...enabledTools, ...clientTools]));
      }
    } catch {
      // Ignore malformed header, use all enabled tools
    }
  }

  // Intent detection: narrow tools for specific keywords so weaker models pick the right one
  const lastUserMsg = uiMessages.filter((m) => m.role === "user").slice(-1)[0];
  const lastUserText = lastUserMsg?.parts
    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .toLowerCase() ?? "";

  const wantsChart = /\b(chart|graph|visualize|visualise|plot|bar chart|pie chart|line chart)\b/.test(lastUserText);
  const wantsWalkthrough = /\b(walkthrough|walk me through|walk-through|tour|guide me through|give me a tour)\b/.test(lastUserText);
  const wantsHighlight = /\b(highlight|underline|mark|point (to|out)|show me where)\b/.test(lastUserText);
  const wantsBookmark = /\b(bookmark|save (this|a) (note|bookmark)|remember this|note this|save for later)\b/.test(lastUserText);
  const wantsNavigate = /\b(go to|open|switch to|show me the|take me to|bring me to|navigate to)\b/.test(lastUserText);

  if (wantsChart) {
    activeToolsList = activeToolsList.filter((t) => t === "render_chart");
  } else if (wantsWalkthrough) {
    activeToolsList = activeToolsList.filter((t) => t === "walkthrough_document");
  } else if (wantsHighlight) {
    // Highlight requests: only need switch_document (to open correct doc), navigate_pdf (to scroll), highlight_text (the main action)
    activeToolsList = activeToolsList.filter((t) =>
      t === "highlight_text" || t === "switch_document" || t === "navigate_pdf" || t === "open_document_preview"
    );
  } else if (wantsBookmark) {
    activeToolsList = activeToolsList.filter((t) => t === "save_bookmark");
  } else if (wantsNavigate) {
    // Pure navigation — don't let the agent search or loop
    activeToolsList = activeToolsList.filter((t) =>
      t === "switch_document" || t === "navigate_pdf" || t === "open_document_preview"
    );
  }

  const portalTools = createPortalTools(documentContent, activeToolsList, portal);

  const pages = splitPages(documentContent);
  let systemPrompt = buildSystemPrompt(portal, pages.length);

  // Read context tags from header (Base64-encoded to avoid non-ISO-8859-1 issues)
  const portalContextHeader = request.headers.get("x-portal-context");
  if (portalContextHeader) {
    try {
      const decoded = decodeURIComponent(escape(atob(portalContextHeader)));
      const contextTexts = JSON.parse(decoded) as string[];
      if (Array.isArray(contextTexts) && contextTexts.length > 0) {
        // Extract "Viewing:" tag to tell AI which doc is currently open
        const viewingTag = contextTexts.find(t => t.startsWith("Viewing: "));
        const otherTags = contextTexts.filter(t => !t.startsWith("Viewing: "));

        if (viewingTag) {
          const viewingDocTitle = viewingTag.replace("Viewing: ", "");
          systemPrompt += `\n\nIMPORTANT: The user is currently viewing "${viewingDocTitle}". When they say "this document", "this one", or ask questions without specifying a document, they mean "${viewingDocTitle}". Use lookup_document to load its content if needed before answering.`;
        }

        if (otherTags.length > 0) {
          systemPrompt += `\n\n--- User-Highlighted Context ---\nThe user has highlighted the following text from the document. Reference these selections when relevant to the conversation:\n${otherTags.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`;
        }
      }
    } catch {
      // Ignore malformed context header
    }
  }

  // Voice mode — shorter responses unless explicitly asked for detail
  const isVoiceMode = request.headers.get("x-voice-mode") === "true";
  if (isVoiceMode) {
    systemPrompt += `\n\nIMPORTANT — VOICE MODE ACTIVE: The user is speaking to you via voice. Keep responses SHORT and conversational (1-3 sentences max). Speak naturally as if in a conversation, not a written response. Only give longer answers if the user explicitly asks for detail or says "explain in detail", "tell me more", etc. Use simple language. Avoid markdown formatting, bullet points, and code blocks — these don't work well in voice. Focus on the key point first.`;
  }

  const modelMessages = await convertToModelMessages(uiMessages);

  // Default to gemini 3.1 flash-lite for cheaper testing
  const modelId = portal.model ?? "google/gemini-3.1-flash-lite";

  const agent = new ToolLoopAgent({
    model: gateway(modelId),
    instructions: systemPrompt,
    tools: portalTools,
    stopWhen: stepCountIs(4),
  });

  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages: uiMessages,
    onFinish: () => {},
  });

  return response;
}
