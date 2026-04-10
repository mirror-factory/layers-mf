"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Expand,
  Shrink,
  Volume2,
  List,
  Pause,
  Search,
  Navigation,
  BarChart3,
  Globe,
  Highlighter,
  FileText,
  BookOpen,
  X,
  Download,
  Settings2,
  MessageSquarePlus,
  MessageSquare,
  StickyNote,
  FileSpreadsheet,
  Image as ImageIcon,
  FileIcon,
  FolderOpen,
  Sun,
  Moon,
  Info,
  Footprints,
  Library as LibraryIcon,
  Columns2,
  RectangleVertical,
  Mic,
  MicOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLUEWAVE_DOCUMENTS } from "@/lib/bluewave-docs";
import { read, utils } from "xlsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PortalData } from "@/app/portal/[token]/page";
import { PortalPdfViewer, type PdfControls, type TextAction } from "@/components/portal-pdf-viewer";
import { ChatInterface } from "@/components/chat-interface";
import { AnnotationOverlay, type Annotation } from "@/components/portal-annotation-overlay";
import { PortalWelcomeModal } from "@/components/portal-welcome-modal";
import { PortalVoiceMode } from "@/components/portal-voice-mode";
import { PortalOnboarding } from "@/components/portal-onboarding";

// ---------------------------------------------------------------------------
// Context Tag type
// ---------------------------------------------------------------------------

interface ContextTag {
  id: string;
  text: string;
}

const MAX_CONTEXT_TAGS = 5;

function truncateText(text: string, maxLength = 40): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// ---------------------------------------------------------------------------
// Context Tags Bar
// ---------------------------------------------------------------------------

function ContextTagsBar({
  tags,
  onRemove,
}: {
  tags: ContextTag[];
  onRemove: (id: string) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-white/5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-muted-foreground mr-1">
          Context
        </span>
        {tags.map((tag) => (
          <Tooltip key={tag.id}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-xs text-sky-600 transition-colors hover:bg-sky-400/15">
                <span className="max-w-[200px] md:max-w-none truncate">
                  {tag.text}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(tag.id);
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-sky-400/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-xs text-xs"
            >
              {tag.text}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Quick Actions Bar
// ---------------------------------------------------------------------------

function QuickActions({
  onAction,
  brandColor,
  isDark,
}: {
  onAction: (prompt: string) => void;
  brandColor: string;
  isDark: boolean;
}) {
  const actions = [
    { label: "Summarize", prompt: "Give me a concise summary of the key points in this document" },
    { label: "Timeline", prompt: "Show me the project timeline and milestones" },
    { label: "Budget", prompt: "What's the total budget and payment breakdown?" },
    { label: "Compare", prompt: "Compare the main documents and highlight differences" },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.prompt)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium border transition-colors",
            isDark
              ? "border-white/10 text-white/60 hover:bg-white/5 hover:text-white/80"
              : "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool config (mirrors portal-chat.tsx TOOL_CONFIG)
// ---------------------------------------------------------------------------

const TOOL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  search_document: {
    label: "Search",
    icon: Search,
    description: "Search for keywords within the current document",
  },
  navigate_pdf: {
    label: "Navigate",
    icon: Navigation,
    description: "Jump to a specific page in the PDF viewer",
  },
  navigate_portal: {
    label: "Go To",
    icon: Navigation,
    description: "Navigate to a specific tab or section",
  },
  render_chart: {
    label: "Charts",
    icon: BarChart3,
    description: "Create interactive data visualizations",
  },
  web_search: {
    label: "Web Search",
    icon: Globe,
    description: "Search the web for current information",
  },
  highlight_text: {
    label: "Highlight",
    icon: Highlighter,
    description: "Highlight specific text in the document",
  },
  get_page_content: {
    label: "Read Page",
    icon: FileText,
    description: "Read the full content of a specific page",
  },
  summarize_section: {
    label: "Summarize",
    icon: BookOpen,
    description: "Summarize a section or page range",
  },
  add_annotation: {
    label: "Annotate",
    icon: StickyNote,
    description: "Add visual callouts and notes to the PDF",
  },
  walkthrough_document: {
    label: "Walkthrough",
    icon: Footprints,
    description: "Guided animated tour through the document",
  },
  get_document_registry: {
    label: "Doc Registry",
    icon: LibraryIcon,
    description: "List all available documents in the library",
  },
  lookup_document: {
    label: "Lookup",
    icon: Search,
    description: "Search and read content from a library document",
  },
  open_document_preview: {
    label: "Open Doc",
    icon: FileText,
    description: "Open a library document in the viewer",
  },
  capture_screen: {
    label: "Capture",
    icon: ImageIcon,
    description: "Capture and describe a region of the document",
  },
  generate_brief: {
    label: "Brief",
    icon: FileText,
    description: "Generate an executive summary of all documents",
  },
  track_reading: {
    label: "Progress",
    icon: BookOpen,
    description: "Track reading progress and suggest unread sections",
  },
  save_bookmark: {
    label: "Bookmark",
    icon: StickyNote,
    description: "Save a note or bookmark on any section",
  },
  compare_documents: {
    label: "Compare",
    icon: Columns2,
    description: "Compare two documents side by side",
  },
  share_feedback: {
    label: "Feedback",
    icon: MessageSquare,
    description: "Share your notes and questions with the sender",
  },
};

// Tools info modal
function ToolsInfoModal({
  open,
  onClose,
  enabledTools,
  isDark,
  brandColor,
}: {
  open: boolean;
  onClose: () => void;
  enabledTools: string[];
  isDark: boolean;
  brandColor: string;
}) {
  if (!open) return null;

  // Always-on tools (not configurable)
  const alwaysOnTools = ["get_document_registry", "lookup_document", "open_document_preview", "generate_brief", "track_reading", "save_bookmark", "compare_documents", "share_feedback"];
  const configurableTools = enabledTools.filter(t => !alwaysOnTools.includes(t));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className={cn("absolute inset-0 backdrop-blur-sm", isDark ? "bg-black/50" : "bg-black/20")} />
      <div
        className={cn(
          "relative z-10 w-full max-w-md mx-4 rounded-2xl border p-6 shadow-2xl",
          isDark ? "bg-[#1e2433] border-white/10" : "bg-white border-gray-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
            AI Tools
          </h3>
          <button onClick={onClose} className={cn("p-1 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-slate-50")}>
            <X className={cn("h-4 w-4", isDark ? "text-white/60" : "text-gray-400")} />
          </button>
        </div>

        <p className={cn("text-xs mb-4", isDark ? "text-white/40" : "text-gray-500")}>
          These tools are available to the AI assistant when answering your questions.
        </p>

        <div className="space-y-1.5 mb-4">
          <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-400")}>
            Configurable Tools
          </p>
          {configurableTools.map((toolId) => {
            const config = TOOL_CONFIG[toolId];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div key={toolId} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${brandColor}20` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: brandColor }} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-xs font-medium", isDark ? "text-white" : "text-gray-800")}>{config.label}</p>
                  <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-gray-500")}>{config.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-400")}>
            Always Available
          </p>
          {alwaysOnTools.map((toolId) => {
            const config = TOOL_CONFIG[toolId];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div key={toolId} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                  <Icon className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-xs font-medium", isDark ? "text-white" : "text-gray-800")}>{config.label}</p>
                  <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-gray-500")}>{config.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TOC extraction
// ---------------------------------------------------------------------------

interface TocEntry {
  id: string;
  title: string;
  level: number;
  estimatedPage: number;
}

function extractToc(content: string | null, totalPages: number): TocEntry[] {
  if (!content) return [];

  const lines = content.split("\n");
  const entries: TocEntry[] = [];
  const totalChars = content.length;

  for (let i = 0; i < lines.length; i++) {
    // Strip bold markers (**text**, __text__) and leading/trailing whitespace
    const raw = lines[i].trim();
    if (!raw) continue;
    const line = raw.replace(/\*\*|__/g, "").trim();
    if (!line) continue;

    let match: RegExpMatchArray | null = null;
    let level = 1;
    let title = "";

    // Markdown headings: # Heading, ## Heading, ### Heading
    match = line.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      level = match[1].length;
      title = match[2].trim();
    }

    // Numbered sections: 1. Title, 2.1 Title, 1.2.3 Title
    // Require title ≤80 chars and starting with uppercase to reduce body-text false positives
    if (!title) {
      match = line.match(/^(\d+(?:\.\d+)*)\s*[.)\-:]?\s+([A-Z].{1,78})/);
      if (match) {
        const numbering = match[1];
        const dots = (numbering.match(/\./g) || []).length;
        level = dots + 1;
        title = match[2].trim();
        // Skip if it looks like a sentence (contains a verb-like word mid-text with comma/period patterns)
        if (title.includes(". ") || title.endsWith(".")) title = "";
      }
    }

    // Lines starting with "Section", "Chapter", "Part"
    if (!title) {
      match = line.match(/^(Section|Chapter|Part)\s+(\d+[.:]\s*)?(.{3,80})/i);
      if (match) {
        level = match[1].toLowerCase() === "part" ? 1 : match[1].toLowerCase() === "chapter" ? 1 : 2;
        title = match[3]?.trim() || line;
      }
    }

    if (title) {
      // Remove trailing punctuation like colons, bold markers
      title = title.replace(/\*\*|__/g, "").replace(/[:]+$/, "").trim();
      if (!title) continue;
      // Estimate page based on character offset
      const charOffset = lines.slice(0, i).join("\n").length;
      const estimatedPage = totalPages > 0
        ? Math.max(1, Math.round((charOffset / totalChars) * totalPages))
        : 1;

      entries.push({
        id: `toc-${i}`,
        title,
        level: Math.min(level, 4),
        estimatedPage,
      });
    }
  }

  // Deduplicate: skip entries with the same title as a previous one
  const seen = new Set<string>();
  const deduped = entries.filter((e) => {
    const key = e.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Cap at 40 entries — beyond that the sidebar becomes unusable
  return deduped.slice(0, 40);
}

// ---------------------------------------------------------------------------
// Audio progress helper
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// PortalViewer
// ---------------------------------------------------------------------------

interface PortalViewerProps {
  portal: PortalData;
}

export function PortalViewer({ portal }: PortalViewerProps) {
  const [chatPosition, setChatPosition] = useState<"sidebar" | "center" | "corner">(portal.default_expanded ? "sidebar" : "corner");
  const expanded = chatPosition === "sidebar";
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(portal.page_count ?? 0);
  const [chatOpen, setChatOpen] = useState(false);
  const [pdfControls, setPdfControls] = useState<PdfControls | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [lastAIResponse, setLastAIResponse] = useState<string>("");
  const [voiceActive, setVoiceActive] = useState(false);
  const toggleVoiceMode = useCallback(() => setVoiceActive(prev => !prev), []);
  const [showToolsInfo, setShowToolsInfo] = useState(false);
  const [twoColumnMode, setTwoColumnMode] = useState(false);
  // Force single column when sidebar is docked
  const effectiveTwoColumn = twoColumnMode && chatPosition !== "sidebar";
  const progressRef = useRef<HTMLDivElement | null>(null);

  // Context tags state
  const [contextTags, setContextTags] = useState<ContextTag[]>([]);

  // Highlight text from chat tools (nonce forces re-trigger for same text)
  const highlightNonceRef = useRef(0);
  const [highlightText, setHighlightText] = useState<string | undefined>(undefined);
  const [highlightNonce, setHighlightNonce] = useState(0);

  // Annotations state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const addAnnotation = useCallback(
    (annotation: Omit<Annotation, "id" | "visible">) => {
      setAnnotations((prev) => [
        ...prev,
        {
          ...annotation,
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          visible: true,
        },
      ]);
    },
    []
  );

  const dismissAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // View mode and Library Previews
  const [activeView, setActiveView] = useState<"document" | "library-doc" | "library">("library");
  const [openedLibraryDocs, setOpenedLibraryDocs] = useState<typeof BLUEWAVE_DOCUMENTS>([]);
  const [activeLibraryDocIndex, setActiveLibraryDocIndex] = useState<number>(-1);
  const [docPreviewText, setDocPreviewText] = useState<string | null>(null);
  const [docPreviewHtml, setDocPreviewHtml] = useState<string | null>(null);
  const [docPreviewTable, setDocPreviewTable] = useState<string[][] | null>(null);
  const [docPreviewMessages, setDocPreviewMessages] = useState<string[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [docxArrayBuffer, setDocxArrayBuffer] = useState<ArrayBuffer | null>(null);
  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  const jspreadsheetRef = useRef<HTMLDivElement | null>(null);

  const handleOpenDocPreview = async (doc: typeof BLUEWAVE_DOCUMENTS[0], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Check if already opened — switch tab but still reload content
    const existingIdx = openedLibraryDocs.findIndex(d => d.id === doc.id);
    if (existingIdx >= 0) {
      setActiveLibraryDocIndex(existingIdx);
      setActiveView("library-doc");
    } else {
      // Add to opened tabs
      setOpenedLibraryDocs(prev => [...prev, doc]);
      setActiveLibraryDocIndex(openedLibraryDocs.length);
      setActiveView("library-doc");
    }

    // Always clear previous content and reload for the selected doc
    setDocxArrayBuffer(null);
    setDocPreviewText(null);
    setDocPreviewHtml(null);
    setDocPreviewTable(null);
    setDocPreviewMessages([]);

    if (doc.type === "image" || doc.type === "pdf") {
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);

    try {
      const docUrl = encodeURI(doc.url);
      const fetchBinary = async () => {
        const res = await fetch(docUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch document (${res.status})`);
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
          throw new Error("Preview unavailable. File request returned HTML.");
        }
        return res.arrayBuffer();
      };

      if (doc.type === "docx") {
        const arrayBuffer = await fetchBinary();
        setDocxArrayBuffer(arrayBuffer);
        return;
      }

      if (doc.type === "xlsx") {
        const arrayBuffer = await fetchBinary();
        const workbook = read(arrayBuffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          blankrows: false,
          defval: "",
        });
        // Normalize: ensure all rows have the same column count
        const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
        const normalized = rows.map((row) => {
          const cells = row.map((cell) => (cell ?? "").toString());
          while (cells.length < maxCols) cells.push("");
          return cells;
        });
        // Trim trailing empty rows
        while (normalized.length > 0 && normalized[normalized.length - 1].every(c => c === "")) {
          normalized.pop();
        }
        setDocPreviewTable(normalized.length > 0 ? normalized : [["No data found"]]);
        return;
      }

      const res = await fetch("/portal-docs/bluewave/_manifest.json");
      const manifest = await res.json();
      const loadedDoc = manifest.find((d: any) => d.id === doc.id);
      if (loadedDoc) {
        setDocPreviewText(loadedDoc.extractedText);
        setDocPreviewHtml(loadedDoc.extractedHtml);
      }
    } catch (err) {
      console.error("Failed to load document text:", err);
      const message = err instanceof Error ? err.message : "Preview unavailable.";
      setDocPreviewText(message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Reload library doc content when switching tabs or re-visiting
  const [libDocLoadCounter, setLibDocLoadCounter] = useState(0);
  useEffect(() => {
    const doc = openedLibraryDocs[activeLibraryDocIndex];
    if (!doc || activeView !== "library-doc") return;

    const timer = setTimeout(() => {
      setDocxArrayBuffer(null);
      setDocPreviewTable(null);
      setDocPreviewHtml(null);
      setDocPreviewText(null);
      setIsPreviewLoading(true);
      void handleOpenDocPreview(doc);
    }, 150); // Debounce rapid clicks

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLibraryDocIndex, activeView, libDocLoadCounter]);

  // Clear library doc state when leaving library-doc view (prevents stale content on view switch)
  useEffect(() => {
    if (activeView === "library-doc") return;
    setDocxArrayBuffer(null);
    setDocPreviewTable(null);
    setDocPreviewHtml(null);
    setDocPreviewText(null);
    setIsPreviewLoading(false);
  }, [activeView]);

  // Render DOCX via docx-preview when arrayBuffer is ready
  useEffect(() => {
    if (!docxArrayBuffer || !docxContainerRef.current) return;
    const container = docxContainerRef.current;
    container.innerHTML = "";
    let cancelled = false;
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(docxArrayBuffer, container, undefined, {
          className: "docx-preview-body",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
        });
      } catch (err) {
        console.error("docx-preview renderAsync failed:", err);
        if (!cancelled && container) {
          container.innerHTML = `<p class="text-red-500 p-4">Failed to render document. Try downloading instead.</p>`;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [docxArrayBuffer]);

  // Render XLSX via jspreadsheet-ce when table data is ready
  useEffect(() => {
    const currentLibDoc = openedLibraryDocs[activeLibraryDocIndex];
    if (!docPreviewTable || activeView !== "library-doc" || currentLibDoc?.type !== "xlsx") return;

    // Wait a tick for the ref to be available after React renders the xlsx container
    const timer = setTimeout(() => {
      const container = jspreadsheetRef.current;
      if (!container) return;
      container.innerHTML = "";

      (async () => {
        try {
          const jspreadsheet = (await import("jspreadsheet-ce")).default;
          // @ts-expect-error -- CSS import
          await import("jsuites/dist/jsuites.css");
          // @ts-expect-error -- CSS import
          await import("jspreadsheet-ce/dist/jspreadsheet.css");

          const columns = docPreviewTable[0]?.map((header: string, i: number) => ({
            title: header || String.fromCharCode(65 + i),
            width: 120,
          })) || [];

          jspreadsheet(container, {
            data: docPreviewTable.slice(1) as unknown as string[][],
            columns: columns as unknown[],
            tableOverflow: true,
          tableWidth: "100%",
          tableHeight: "calc(100vh - 6rem)",
          editable: false,
          columnSorting: true,
          search: true,
          pagination: false,
          freezeColumns: 0,
          defaultColWidth: 120,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      } catch (err) {
        console.error("Jspreadsheet init failed:", err);
      }
    })();
    }, 100); // Wait for React to render the xlsx container

    return () => { clearTimeout(timer); };
  }, [docPreviewTable, activeView, openedLibraryDocs, activeLibraryDocIndex]);

  // Handle tool outputs from ChatInterface (annotations, navigation, highlights)
  const handleToolOutput = useCallback(
    (toolName: string, output: unknown) => {
      const out = output as Record<string, unknown>;
      if (toolName === "add_annotation" && out.action === "add_annotation") {
        addAnnotation({
          page: Number(out.page) || 1,
          text: String(out.text ?? ""),
          note: String(out.note ?? ""),
          type: (out.type as Annotation["type"]) ?? "info",
        });
      } else if (toolName === "navigate_pdf" && out.action === "navigate") {
        const rawPage = Number(out.page);
        const maxPage = pdfControls?.numPages ?? totalPages ?? 1;
        const clampedPage = Math.max(1, Math.min(rawPage, maxPage));
        if (clampedPage > 0 && pdfControls) {
          pdfControls.goToPage?.(clampedPage);
          setCurrentPage(clampedPage);
        }
      } else if (toolName === "highlight_text" && out.action === "highlight") {
        setHighlightText(String(out.text ?? ""));
        highlightNonceRef.current += 1;
        setHighlightNonce(highlightNonceRef.current);
        const page = Number(out.page);
        if (page > 0 && pdfControls) {
          pdfControls.goToPage?.(page);
          setCurrentPage(page);
        }
        // Add persistent annotation for the highlight
        addAnnotation({
          page: page || currentPage,
          text: String(out.text ?? ""),
          note: String(out.reason ?? "Highlighted by AI"),
          type: "highlight",
        });
      } else if (toolName === "capture_screen" && out.action === "capture_screen") {
        // Animate a capture effect on the document viewer
        const viewerEl = document.querySelector("[data-portal-viewer]");
        if (viewerEl) {
          const flash = document.createElement("div");
          flash.style.cssText = `
            position: absolute; inset: 0; z-index: 100;
            background: rgba(12, 228, 242, 0.15);
            pointer-events: none;
            animation: capture-flash 0.6s ease-out forwards;
          `;
          viewerEl.appendChild(flash);
          setTimeout(() => flash.remove(), 700);
        }
      } else if (toolName === "open_document_preview" && out.action === "open_document_preview") {
        const docId = String(out.document_id ?? "");
        // Check library documents first (exact match, then partial title match)
        const libraryDoc = BLUEWAVE_DOCUMENTS.find((item) => item.id === docId)
          || BLUEWAVE_DOCUMENTS.find((item) => item.title.toLowerCase().includes(docId.toLowerCase()))
          || BLUEWAVE_DOCUMENTS.find((item) => docId.toLowerCase().includes(item.title.toLowerCase()));
        if (libraryDoc) {
          // Check if already opened — if so just switch, otherwise reset and open
          const existingIdx = openedLibraryDocs.findIndex(d => d.id === libraryDoc.id);
          if (existingIdx < 0) {
            setDocxArrayBuffer(null);
            setDocPreviewHtml(null);
            setDocPreviewText(null);
            setDocPreviewTable(null);
          }
          void handleOpenDocPreview(libraryDoc);
        } else {
          // Try portal documents — switch to that doc tab
          const portalDocs = portal.documents ?? [];
          const portalIdx = portalDocs.findIndex(
            (d) => d.context_item_id === docId || d.title === docId || d.id === docId
              || d.title.toLowerCase().includes(docId.toLowerCase())
          );
          if (portalIdx >= 0) {
            setActiveDocIndex(portalIdx);
            setActiveView("document");
            setCurrentPage(1);
            setPdfFailed(false);
          }
        }
      } else if (toolName === "save_bookmark" && out.action === "save_bookmark") {
        // Add as an annotation for visual persistence
        addAnnotation({
          page: Number(out.page) || currentPage,
          text: String(out.title ?? "Bookmark"),
          note: String(out.note ?? ""),
          type: "tip",
        });
      } else if (toolName === "walkthrough_document" && out.action === "walkthrough") {
        const sections = out.sections as { page: number; title: string; note: string }[];
        if (sections && pdfControls) {
          // Navigate to first section
          pdfControls.goToPage?.(sections[0]?.page ?? 1);
          setCurrentPage(sections[0]?.page ?? 1);
        }
      } else if (toolName === "switch_document" && out.action === "switch_document") {
        const title = String(out.title ?? "");
        // Try portal documents first
        const portalDocs = portal.documents ?? [];
        const portalIdx = portalDocs.findIndex(d =>
          d.title.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(d.title.toLowerCase())
        );
        if (portalIdx >= 0) {
          setActiveDocIndex(portalIdx);
          setActiveView("document");
          setCurrentPage(1);
          setPdfFailed(false);
          return;
        }
        // Try library documents
        const libraryDoc = BLUEWAVE_DOCUMENTS.find(d =>
          d.title.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(d.title.toLowerCase())
        );
        if (libraryDoc) {
          void handleOpenDocPreview(libraryDoc);
        }
      } else if (toolName === "navigate_portal" && out.action === "navigate") {
        const target = String(out.target ?? "").toLowerCase();
        // Match target to portal docs or library or tab names
        if (target.includes("library")) {
          setActiveView("library");
          return;
        }
        // Try matching portal docs
        const portalDocs = portal.documents ?? [];
        const portalIdx = portalDocs.findIndex(d =>
          d.title.toLowerCase().includes(target) || target.includes(d.title.toLowerCase())
        );
        if (portalIdx >= 0) {
          setActiveDocIndex(portalIdx);
          setActiveView("document");
          setCurrentPage(1);
          return;
        }
        // Try library docs
        const libraryDoc = BLUEWAVE_DOCUMENTS.find(d =>
          d.title.toLowerCase().includes(target) || target.includes(d.title.toLowerCase())
        );
        if (libraryDoc) {
          void handleOpenDocPreview(libraryDoc);
        }
      }
    },
    [addAnnotation, pdfControls, handleOpenDocPreview, openedLibraryDocs, portal.documents]
  );

  // Feature 3: Tool toggles
  const [activeTools, setActiveTools] = useState<Set<string>>(
    () => new Set(portal.enabled_tools ?? [])
  );

  const toggleTool = useCallback((toolId: string) => {
    setActiveTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  // Build extra headers including active tools and context tags
  // Base64-encode context to avoid non-ISO-8859-1 chars in headers (em-dashes, etc.)
  const extraHeaders = useMemo(
    () => ({
      "x-portal-token": portal.share_token,
      "x-active-tools": JSON.stringify([...activeTools]),
      ...(voiceActive && { "x-voice-mode": "true" }),
      ...(contextTags.length > 0 && {
        "x-portal-context": btoa(unescape(encodeURIComponent(JSON.stringify(contextTags.map((t) => t.text))))),
      }),
    }),
    [portal.share_token, activeTools, contextTags, voiceActive]
  );

  // Multi-document switching
  const documents = portal.documents ?? [];
  const [activeDocIndex, setActiveDocIndex] = useState(() => {
    const idx = documents.findIndex(d => d.is_active);
    return idx >= 0 ? idx : 0;
  });
  const activeDoc = documents[activeDocIndex];

  // Auto-add active document to context so AI knows what user is viewing
  useEffect(() => {
    const docTitle = activeView === "library"
      ? "Document Library"
      : activeView === "library-doc" && openedLibraryDocs[activeLibraryDocIndex]
        ? openedLibraryDocs[activeLibraryDocIndex].title
        : activeDoc?.title;
    if (!docTitle) return;
    setContextTags(prev => {
      const filtered = prev.filter(t => !t.text.startsWith("Viewing: "));
      return [{ id: "active-doc", text: `Viewing: ${docTitle}` }, ...filtered];
    });
  }, [activeView, activeDocIndex, activeLibraryDocIndex, openedLibraryDocs, activeDoc?.title]);

  const [pdfFailed, setPdfFailed] = useState(false);
  const rawPdfUrl = activeDoc?.pdf_path || portal.pdf_url;
  // If PDF loading failed or no URL, fall back to text rendering (pass null to viewer)
  const activePdfUrl = pdfFailed ? null : rawPdfUrl;

  // Feature 1: TOC — rebuild when switching documents
  const activeDocContent = useMemo(() => {
    const doc = documents[activeDocIndex];
    return doc?.content || portal.document_content;
  }, [documents, activeDocIndex, portal.document_content]);

  const tocEntries = useMemo(
    () => extractToc(activeDocContent, totalPages),
    [activeDocContent, totalPages]
  );

  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const handleTocNavigate = useCallback((page: number, entryId?: string) => {
    if (pdfControls) {
      pdfControls.goToPage?.(page);
    }
    setCurrentPage(page);
    setActiveTocId(entryId ?? null);
  }, [pdfControls]);

  // Feature 2: Audio
  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setAudioPlaying(!audioPlaying);
  }, [audioPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setAudioDuration(audio.duration);
    const handleDurationChange = () => setAudioDuration(audio.duration);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
    };
  }, [portal.audio_url]);

  const handleAudioSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !audioDuration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audioDuration;
  }, [audioDuration]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setActiveTocId(null); // Clear specific TOC selection when user scrolls
  }, []);

  const handleTotalPages = useCallback((pages: number) => {
    setTotalPages(pages);
  }, []);


  const handleControlsReady = useCallback((controls: PdfControls) => {
    setPdfControls(controls);
  }, []);

  // ---- Context tag management ----
  const addContextTag = useCallback((text: string) => {
    setContextTags((prev) => {
      if (prev.some((t) => t.text === text)) return prev;
      if (prev.length >= MAX_CONTEXT_TAGS) {
        return [...prev.slice(1), { id: crypto.randomUUID(), text }];
      }
      return [...prev, { id: crypto.randomUUID(), text }];
    });
  }, []);

  const removeContextTag = useCallback((id: string) => {
    setContextTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---- Text action from bubble menu ----
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // Clear pending prompt after a short delay so ChatInterface picks it up then it's gone
  useEffect(() => {
    if (pendingPrompt) {
      const timer = setTimeout(() => setPendingPrompt(null), 500);
      return () => clearTimeout(timer);
    }
  }, [pendingPrompt]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setPendingPrompt(text);
    // Don't open full chat — voice mode shows messages inline
  }, []);

  const handleTextAction = useCallback(
    (action: TextAction, text: string) => {
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
      if (action === "send_to_chat") {
        addContextTag(text);
        setChatOpen(true);
      } else {
        const prompts: Record<string, string> = {
          explain: `Explain this section: "${truncated}"`,
          visualize: `Visualize this data as a chart: "${truncated}"`,
          research: `Research and fact-check this claim: "${truncated}"`,
        };
        const prompt = prompts[action] || truncated;
        // Force state change by clearing first
        setPendingPrompt(null);
        requestAnimationFrame(() => {
          // Append an invisible ref comment to guarantee uniqueness even for repeated selections
          setPendingPrompt(prompt + `\n<!-- ref:${Date.now()} -->`);
          if (chatPosition === "corner" || chatPosition === "sidebar") {
            // Chat is already visible in these modes
          } else {
            setChatOpen(true);
          }
        });
      }
    },
    [addContextTag, chatPosition]
  );

  const brandColor = portal.brand_color || "#0DE4F2";

  // Theme mode (default: dark)
  const [portalDark, setPortalDark] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem("portal-theme");
      return stored ? stored === "dark" : true;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", portalDark);
    try {
      localStorage.setItem("portal-theme", portalDark ? "dark" : "light");
    } catch {
      // Ignore storage quota errors in locked-down or full storage contexts
    }
  }, [portalDark]);
  const pd = portalDark;
  const brandAccent = portal.brand_color || "#0DE4F2";
  const activeLibraryDoc = openedLibraryDocs[activeLibraryDocIndex] ?? null;
  const docPreviewIsLight = activeLibraryDoc?.type === "docx" || activeLibraryDoc?.type === "xlsx";

  // ---------------------------------------------------------------------------
  // Tool toggles dropdown menu (Bug 8)
  // ---------------------------------------------------------------------------
  const sidebarToggleButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setChatPosition(prev => prev === "sidebar" ? "corner" : "sidebar")}
      className="hidden md:inline-flex h-7 w-7 text-muted-foreground hover:text-foreground"
      title={chatPosition === "sidebar" ? "Float chat" : "Dock to sidebar"}
    >
      {chatPosition === "sidebar" ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
    </Button>
  );

  // ---------------------------------------------------------------------------
  // TOC sidebar panel
  // ---------------------------------------------------------------------------
  const tocContent = tocEntries.length > 0 ? (
    <nav className="p-2">
      {tocEntries.map((entry) => (
        <button
          key={entry.id}
          onClick={() => { handleTocNavigate(entry.estimatedPage, entry.id); if (typeof window !== "undefined" && window.innerWidth < 768) setShowToc(false); }}
          className={cn(
            "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
            pd ? "hover:bg-white/5" : "hover:bg-slate-50",
            activeTocId === entry.id
              ? pd ? "bg-white/5 text-foreground" : "bg-slate-100 text-slate-900"
              : (!activeTocId && entry.estimatedPage === currentPage)
                ? pd ? "bg-white/5 text-foreground" : "bg-slate-100 text-slate-900"
                : pd ? "text-muted-foreground hover:text-foreground" : "text-slate-500 hover:text-slate-900"
          )}
          style={{ paddingLeft: `${(entry.level - 1) * 12 + 8}px` }}
        >
          <span className="shrink-0 tabular-nums text-muted-foreground/50" style={{ minWidth: "20px" }}>
            {entry.estimatedPage}
          </span>
          <span className={cn(
            "line-clamp-2",
            entry.level === 1 && "font-medium"
          )}>
            {entry.title}
          </span>
        </button>
      ))}
    </nav>
  ) : null;

  // Desktop: sidebar TOC panel
  const tocPanel = showToc && tocEntries.length > 0 ? (
    <>
      {/* Mobile: fullscreen overlay */}
      <div className={cn("fixed inset-0 z-[100] flex flex-col backdrop-blur-xl md:hidden", pd ? "bg-[#1a1f2e]/95" : "bg-slate-50/95")}>
        <div className={cn("flex items-center justify-between px-4 py-3 border-b", pd ? "border-white/5" : "border-slate-200")}>
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contents</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowToc(false)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tocContent}
        </div>
      </div>
      {/* Desktop: sidebar */}
      <div className={cn("hidden md:block w-64 shrink-0 overflow-y-auto backdrop-blur-xl border-r", pd ? "border-white/5 bg-[#1a1f2e]/60" : "border-slate-200 bg-slate-50/80")}>
        <div className={cn("sticky top-0 z-10 flex items-center justify-between px-3 py-2 backdrop-blur-xl border-b", pd ? "border-white/5 bg-[#1a1f2e]/80" : "border-slate-200 bg-slate-50/90")}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contents</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowToc(false)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
        {tocContent}
      </div>
    </>
  ) : null;

  // ---------------------------------------------------------------------------
  // Audio progress bar (inline in header, shown when audio is playing)
  // ---------------------------------------------------------------------------
  const audioProgressBar = portal.audio_url && audioPlaying ? (
    <div className={cn("flex items-center gap-2 mr-2 pr-2 border-r", pd ? "border-white/10" : "border-slate-200")}>
      <span className="text-[10px] tabular-nums text-muted-foreground">{formatTime(audioCurrentTime)}</span>
      <div
        ref={progressRef}
        onClick={handleAudioSeek}
        className="group relative h-1.5 w-24 cursor-pointer rounded-full bg-white/10"
        title="Click to seek"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{
            width: audioDuration > 0 ? `${(audioCurrentTime / audioDuration) * 100}%` : "0%",
            backgroundColor: brandColor,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            left: audioDuration > 0 ? `calc(${(audioCurrentTime / audioDuration) * 100}% - 6px)` : "0",
            backgroundColor: brandColor,
          }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{formatTime(audioDuration)}</span>
    </div>
  ) : null;

  return (
    <div
      className={cn("flex h-screen flex-col overflow-hidden", pd ? "bg-[#1a1f2e]" : "bg-slate-50")}
    >
      {/* Welcome modal */}
      <PortalWelcomeModal
        clientName={portal.client_name ?? "Guest"}
        brandColor={brandColor}
        logoUrl={portal.logo_url ?? undefined}
        isDark={portalDark}
      />

      {/* Guided onboarding (shows after welcome modal) */}
      <PortalOnboarding
        clientName={portal.client_name ?? undefined}
        brandColor={brandColor}
        isDark={portalDark}
      />

      {/* Voice mode — standalone (fixed) only when NOT in corner mode */}
      {chatPosition !== "corner" && (
        <PortalVoiceMode
          onTranscript={handleVoiceTranscript}
          lastAIResponse={lastAIResponse}
          brandColor={brandColor}
          isDark={portalDark}
          disabled={expanded}
        />
      )}
      {/* Tools info modal */}
      <ToolsInfoModal
        open={showToolsInfo}
        onClose={() => setShowToolsInfo(false)}
        enabledTools={[...(portal.enabled_tools ?? ["search_document", "navigate_pdf", "navigate_portal", "highlight_text", "render_chart"]), "get_document_registry", "lookup_document", "open_document_preview"]}
        isDark={portalDark}
        brandColor={brandColor}
      />

      {/* Audio element (hidden) */}
      {portal.audio_url && (
        <audio
          ref={audioRef}
          src={portal.audio_url}
          onEnded={() => setAudioPlaying(false)}
          preload="metadata"
        />
      )}

      {/* Unified Header — two-row layout: Row 1 = logo+title+actions, Row 2 = tabs/picker */}
      <header className={cn(
        "sticky top-0 z-50 backdrop-blur-xl",
        pd ? "border-b border-white/5 bg-[#1a1f2e]/80" : "border-b border-slate-200 bg-slate-50/95"
      )}>
          {/* Row 1: Logo + Title + Actions */}
          <div className="flex items-center justify-between px-3 md:px-4 py-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              {portal.logo_url && (
                <div className="h-7 w-7 md:h-9 md:w-9 rounded-lg overflow-hidden shrink-0">
                  <img
                    src={portal.logo_url}
                    alt="Logo"
                    className="h-full w-auto object-cover object-left"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className={cn("text-sm md:text-base font-semibold tracking-tight truncate", pd ? "text-white" : "text-slate-900")}>
                    {activeView === "library" ? "Document Library" : activeView === "library-doc" && activeLibraryDoc ? activeLibraryDoc.title : (activeDoc?.title || portal.title)}
                  </h1>
                  {portal.client_name && (
                    <span
                      className="text-sm font-medium hidden md:inline shrink-0"
                      style={{ color: brandColor }}
                    >
                      {portal.client_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* PDF page navigation — desktop only */}
              {pdfControls && pdfControls.numPages > 0 && (
                <div className={cn("hidden md:flex items-center gap-0.5 mr-2 pr-2 border-r", pd ? "border-white/10" : "border-slate-200")}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={pdfControls.goToPrev}
                    disabled={currentPage <= 1}
                    className="h-7 w-7 text-muted-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[60px] text-center text-xs text-muted-foreground tabular-nums">
                    {pdfControls.showSpread && currentPage + 1 <= pdfControls.numPages
                      ? `${currentPage}-${currentPage + 1}`
                      : currentPage}{" "}
                    / {pdfControls.numPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={pdfControls.goToNext}
                    disabled={currentPage >= pdfControls.numPages}
                    className="h-7 w-7 text-muted-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Search button — desktop only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  document.dispatchEvent(
                    new KeyboardEvent("keydown", {
                      key: "f",
                      metaKey: true,
                      bubbles: true,
                    })
                  );
                }}
                className="hidden md:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Search in document (Cmd+F)"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Audio progress bar — shown when playing */}
              {audioProgressBar}

              {portal.audio_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleAudio}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title={audioPlaying ? "Pause audio" : "Play audio"}
                >
                  {audioPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              )}

              {/* Column toggle — desktop only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTwoColumnMode(prev => !prev)}
                disabled={chatPosition === "sidebar"}
                className={cn(
                  "hidden md:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground",
                  chatPosition === "sidebar" && "opacity-30 cursor-not-allowed"
                )}
                title={chatPosition === "sidebar" ? "Single column (sidebar active)" : effectiveTwoColumn ? "Single column" : "Two column view"}
              >
                {effectiveTwoColumn ? <RectangleVertical className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
              </Button>

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPortalDark((prev) => !prev)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={portalDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {portalDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {/* Chat toggle — mobile only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatOpen((prev) => !prev)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
                title={chatOpen ? "Hide chat" : "Show chat"}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>

              {/* Download All — ZIP of all library documents */}
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    const { default: JSZip } = await import("jszip");
                    const zip = new JSZip();
                    const folder = zip.folder("Mirror-Factory-BlueWave-Proposal");
                    if (!folder) return;
                    for (const doc of BLUEWAVE_DOCUMENTS) {
                      try {
                        const res = await fetch(encodeURI(doc.url));
                        if (res.ok) {
                          const blob = await res.blob();
                          folder.file(doc.filename, blob);
                        }
                      } catch {
                        // Skip failed downloads
                      }
                    }
                    const content = await zip.generateAsync({ type: "blob" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(content);
                    a.download = "Mirror-Factory-BlueWave-Proposal.zip";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  } catch (err) {
                    console.error("ZIP download failed:", err);
                  }
                }}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Download all documents"
              >
                <Download className="h-4 w-4" />
              </Button>

              {/* Expand/shrink — desktop only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatPosition(prev => prev === "sidebar" ? "corner" : "sidebar")}
                className="hidden md:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground"
                title={expanded ? "Compact mode" : "Expanded mode"}
              >
                {chatPosition === "sidebar" ? (
                  <Shrink className="h-4 w-4" />
                ) : (
                  <Expand className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Row 2: Desktop tabs OR Mobile doc picker */}
          <div className="px-3 md:px-4 pb-2">
            {/* Desktop: inline tabs */}
            <div className="hidden md:flex gap-1">
              {documents.map((doc, i) => (
                <button
                  key={doc.id}
                  onClick={() => { setActiveDocIndex(i); setActiveView("document"); setCurrentPage(1); setPdfFailed(false); }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                    i === activeDocIndex && activeView === "document"
                      ? "text-primary-foreground"
                      : pd ? "text-muted-foreground hover:text-foreground hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                  )}
                  style={i === activeDocIndex && activeView === "document" ? { backgroundColor: brandColor } : undefined}
                >
                  {doc.title}
                </button>
              ))}
              {/* Opened library doc tabs */}
              {openedLibraryDocs.map((ldoc, i) => (
                <button
                  key={ldoc.id}
                  onClick={() => { setActiveLibraryDocIndex(i); setActiveView("library-doc"); setLibDocLoadCounter(c => c + 1); }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1",
                    i === activeLibraryDocIndex && activeView === "library-doc"
                      ? "text-primary-foreground"
                      : pd ? "text-muted-foreground hover:text-foreground hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                  )}
                  style={i === activeLibraryDocIndex && activeView === "library-doc" ? { backgroundColor: brandColor } : undefined}
                >
                  {ldoc.title}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenedLibraryDocs(prev => prev.filter((_, idx) => idx !== i));
                      if (openedLibraryDocs.length <= 1) {
                        setActiveView("document");
                        setActiveLibraryDocIndex(-1);
                      } else if (activeLibraryDocIndex >= i) {
                        setActiveLibraryDocIndex(prev => Math.max(0, prev - 1));
                      }
                    }}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </button>
              ))}
              {/* Library page tab */}
              <button
                onClick={() => setActiveView("library")}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1",
                  activeView === "library"
                    ? "text-primary-foreground"
                    : pd ? "text-muted-foreground hover:text-foreground hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                )}
                style={activeView === "library" ? { backgroundColor: brandColor } : undefined}
              >
                <FolderOpen className="h-3 w-3" /> Library
              </button>
              {/* Library dropdown picker */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                    pd ? "text-muted-foreground hover:text-foreground hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                  )}>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
                  {["Core Documents", "Planning", "Proposal Library", "Architecture"].map((category) => {
                    const categoryDocs = BLUEWAVE_DOCUMENTS.filter(d => d.category === category);
                    if (categoryDocs.length === 0) return null;
                    return (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{category}</div>
                        {categoryDocs.map(ldoc => (
                          <DropdownMenuItem key={ldoc.id} onClick={() => handleOpenDocPreview(ldoc)} className="flex items-start gap-2">
                            {ldoc.type === "pdf" ? <FileIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> :
                             ldoc.type === "xlsx" ? <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> :
                             ldoc.type === "image" ? <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> :
                             <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />}
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{ldoc.title}</p>
                              <p className="text-[10px] text-muted-foreground">{ldoc.type.toUpperCase()} · {ldoc.sizeHuman}</p>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </div>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile: full-width doc picker dropdown */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full h-8 px-2 text-xs font-medium gap-2 justify-between",
                      pd ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {activeView === "library" ? "Library" : activeView === "library-doc" && activeLibraryDoc ? activeLibraryDoc.title : activeDoc?.title || portal.title}
                      </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[calc(100vw-1.5rem)] max-h-80 overflow-y-auto">
                  {/* Portal documents */}
                  {documents.map((doc, i) => (
                    <DropdownMenuItem
                      key={doc.id}
                      onClick={() => { setActiveDocIndex(i); setActiveView("document"); setCurrentPage(1); setPdfFailed(false); }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span className="truncate">{doc.title}</span>
                    </DropdownMenuItem>
                  ))}
                  {/* Opened library doc tabs */}
                  {openedLibraryDocs.length > 0 && <DropdownMenuSeparator />}
                  {openedLibraryDocs.map((ldoc, i) => (
                    <DropdownMenuItem
                      key={`lib-${ldoc.id}`}
                      onClick={() => { setActiveLibraryDocIndex(i); setActiveView("library-doc"); setLibDocLoadCounter(c => c + 1); }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span className="truncate">{ldoc.title}</span>
                    </DropdownMenuItem>
                  ))}
                  {/* Library page */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveView("library")}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    <span className="font-medium">Browse Library</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {BLUEWAVE_DOCUMENTS.map(ldoc => (
                    <DropdownMenuItem key={`pick-${ldoc.id}`} onClick={() => handleOpenDocPreview(ldoc)} className="flex items-start gap-2">
                      {ldoc.type === "pdf" ? <FileIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> :
                       ldoc.type === "xlsx" ? <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /> :
                       ldoc.type === "image" ? <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> :
                       <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{ldoc.title}</p>
                        <p className="text-[10px] text-muted-foreground">{ldoc.type.toUpperCase()} · {ldoc.sizeHuman}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

      {/* PDF viewer area */}
      <div data-portal-viewer className="flex flex-1 overflow-hidden relative" style={{ height: 'calc(100vh - 3rem)' }}>
        {activeView === "document" && tocPanel}

        {activeView === "library" ? (
          <div className={cn("flex-1 overflow-y-auto p-6 md:p-12", pd ? "" : "bg-slate-100")}>
            <div className="mx-auto max-w-5xl">
              <h2 className={cn("text-2xl font-bold mb-6", pd ? "text-white" : "text-slate-900")}>Document Library</h2>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {BLUEWAVE_DOCUMENTS.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => handleOpenDocPreview(doc)}
                    className={cn(
                      "text-left rounded-xl p-4 border transition-all",
                      pd ? "border-white/10 hover:border-white/20 bg-white/[0.03]" : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {doc.type === "pdf" ? <FileIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" /> :
                       doc.type === "xlsx" ? <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-green-500" /> :
                       doc.type === "image" ? <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /> :
                       <FileText className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />}
                      <div className="min-w-0">
                        <p className={cn("font-semibold text-sm", pd ? "text-white" : "text-slate-900")}>{doc.title}</p>
                        <p className={cn("text-xs mt-1", pd ? "text-white/40" : "text-slate-500")}>{doc.type.toUpperCase()} · {doc.sizeHuman}</p>
                        {doc.description && <p className={cn("text-xs mt-2 line-clamp-2", pd ? "text-white/30" : "text-slate-400")}>{doc.description}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : activeView === "library-doc" && activeLibraryDoc ? (
          <div
            key={`libdoc-${activeLibraryDoc.id}-${libDocLoadCounter}`}
            className={cn("flex-1 overflow-y-auto p-6", pd ? "bg-[#0a0e1a]" : "bg-slate-100")}
          >
            {/* Viewer content — no header bar, tabs handle navigation */}
            <div>
              {activeLibraryDoc.type === "image" ? (
                <div className="flex min-h-[70vh] items-center justify-center">
                  <img src={activeLibraryDoc.url} alt={activeLibraryDoc.title} className={cn("max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain border", pd ? "border-white/10" : "border-slate-200")} />
                </div>
              ) : activeLibraryDoc.type === "xlsx" && docPreviewTable ? (
                <div className="p-4 md:p-6">
                  <div className="mx-auto max-w-6xl min-h-[60vh] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div ref={jspreadsheetRef} className="w-full" />
                    <div className="overflow-auto max-h-[80vh] jspreadsheet-fallback">
                      <table className="min-w-full border-collapse text-left text-[13px] text-slate-700">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className="border-b border-r border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-medium text-slate-400 w-10">#</th>
                            {docPreviewTable[0].map((cell, cellIdx) => (
                              <th key={`h-${cellIdx}`} className="border-b border-r border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-800 text-xs whitespace-nowrap">
                                {cell || String.fromCharCode(65 + cellIdx)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {docPreviewTable.slice(1).map((row, rowIdx) => (
                            <tr key={`row-${rowIdx}`} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                              <td className="border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-medium text-slate-400 w-10">{rowIdx + 2}</td>
                              {row.map((cell, cellIdx) => (
                                <td key={`cell-${rowIdx}-${cellIdx}`} className="border-b border-r border-slate-200 px-3 py-1.5 align-top whitespace-nowrap">{cell || ""}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : isPreviewLoading ? (
                <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-500" />
                  <p className={cn("text-sm", pd ? "text-white/50" : "text-slate-500")}>Loading document...</p>
                </div>
              ) : docxArrayBuffer && activeLibraryDoc.type === "docx" ? (
                /* docx-preview renders directly into this container — edge-to-edge */
                <div
                  ref={docxContainerRef}
                  className={cn("docx-preview-wrapper mx-auto bg-white rounded-lg shadow-lg min-h-[80vh] overflow-hidden", effectiveTwoColumn ? "max-w-6xl two-column" : "max-w-4xl")}
                />
              ) : (
                <div
                  className={cn(
                    "mx-auto max-w-4xl rounded-xl shadow-sm border",
                    "bg-white border-slate-200"
                  )}
                  style={{ padding: "2.5rem 3rem", minHeight: "80vh" }}
                >
                  {docPreviewHtml ? (
                    <div
                      className="prose prose-sm sm:prose-base max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-a:text-blue-600 prose-table:border-collapse prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-th:border prose-th:border-slate-300 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-img:rounded-lg prose-li:text-gray-700"
                      dangerouslySetInnerHTML={{ __html: docPreviewHtml }}
                    />
                  ) : (
                    <pre
                      className="whitespace-pre-wrap font-serif text-[15px] leading-[1.8] text-gray-700 tracking-normal"
                    >
                      {docPreviewText || "No text content could be extracted from this document."}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={cn(
            "relative overflow-y-auto h-full transition-all duration-300",
            expanded ? cn("w-[65%] border-r", pd ? "border-white/5" : "border-slate-200") : "flex-1 pb-20",
            pd ? "" : "bg-slate-100"
          )}>
          <PortalPdfViewer
            pdfUrl={activePdfUrl}
            textContent={activeDocContent || portal.document_content}
            spread={twoColumnMode}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onTotalPages={handleTotalPages}
            onControlsReady={handleControlsReady}
            onTextAction={handleTextAction}
            highlightText={highlightText}
            highlightNonce={highlightNonce}
            onLoadError={() => setPdfFailed(true)}
            brandColor={brandColor}
            isDark={portalDark}
          />
          {/* Annotation overlay — rendered on top of PDF pages */}
          <AnnotationOverlay
            annotations={annotations}
            onDismiss={dismissAnnotation}
            currentPage={currentPage}
            totalPages={totalPages}
          />
        </div>
        )}

        {/* Chat sidebar spacer — reserves width when expanded, header is in the fixed overlay */}
        <div className={cn(
          "flex flex-col h-full min-h-0 overflow-hidden transition-all duration-300 border-l",
          pd ? "border-white/5" : "border-slate-200",
          expanded ? "w-[35%]" : "w-0"
        )} />
      </div>

      {/* SINGLE ChatInterface — always mounted, positioned via CSS */}
      <div
        className={cn(
          "fixed z-40 flex flex-col transition-transform duration-300",
          chatPosition === "sidebar"
            ? cn("right-0 top-12 w-[35%] bottom-0 border-l", pd ? "bg-[#1a1f2e] border-white/5" : "bg-slate-50 border-slate-200")
            : chatPosition === "corner"
              ? cn("right-4 bottom-4 w-96 h-[500px] rounded-2xl shadow-2xl border z-50", pd ? "bg-[#1a1f2e] border-white/10" : "bg-slate-50 border-slate-200")
              : cn(
                  "left-0 right-0 bottom-0",
                  chatOpen ? "h-[85vh] rounded-t-2xl overflow-hidden" : "",
                  chatOpen ? "md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl md:px-4 md:pb-0 md:h-[55vh] md:rounded-2xl" : "md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl md:px-4"
                )
        )}
      >
        {chatPosition === "sidebar" && (
          /* Sidebar header — inside fixed overlay so it's visible above content */
          <div className={cn("flex items-center justify-between px-3 py-1.5 shrink-0 border-b min-w-0", pd ? "border-white/5" : "border-slate-200")}>
            <div className="flex-1 min-w-0 overflow-x-auto">
              <ContextTagsBar tags={contextTags} onRemove={removeContextTag} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowToolsInfo(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="AI Tools info"
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
              {sidebarToggleButton}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatKey((k) => k + 1)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="New chat"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
        {chatPosition === "corner" && (
          /* Corner mini chat — context pill + inline voice */
          <div className={cn("rounded-t-2xl", pd ? "border-white/10" : "border-slate-200")}>
            <div className={cn("flex items-center justify-between px-3 py-1.5 border-b", pd ? "border-white/10" : "border-slate-200")}>
              <ContextTagsBar tags={contextTags} onRemove={removeContextTag} />
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={toggleVoiceMode}
                  className={cn("p-1.5 rounded-lg transition-colors", voiceActive ? "" : pd ? "hover:bg-white/10" : "hover:bg-slate-100")}
                  style={voiceActive ? { backgroundColor: brandColor } : undefined}
                  title={voiceActive ? "Stop voice" : "Voice mode"}
                >
                  {voiceActive ? <Mic className="h-3.5 w-3.5 text-white" /> : <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {sidebarToggleButton}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatKey((k) => k + 1)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="New chat"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Inline voice mode is now rendered inside ChatInterface —
                it replaces the input area when voiceActive is true */}
            <QuickActions
              onAction={(prompt) => {
                setPendingPrompt(null);
                requestAnimationFrame(() => {
                  setPendingPrompt(prompt + `\n<!-- ref:${Date.now()} -->`);
                });
              }}
              brandColor={brandColor}
              isDark={portalDark}
            />
          </div>
        )}
        {chatPosition === "center" && !chatOpen && (
          /* Floating prompt bar — just the input + expand button */
          <div className={cn("flex items-center gap-2 rounded-none md:rounded-2xl backdrop-blur-xl shadow-2xl px-4 py-2.5 pb-4 md:pb-2.5 border-t md:border", pd ? "border-white/10 bg-[#1a1f2e]/95" : "border-slate-200 bg-slate-50/95")}>
            <button
              onClick={() => setChatOpen(true)}
              className="flex-1 text-left text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
            >
              Ask about this document...
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowToolsInfo(true)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="AI Tools info"
              >
                <Info className="h-4 w-4" />
              </Button>
              {sidebarToggleButton}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatOpen(true)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Open chat"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {chatPosition === "center" && chatOpen && (
          /* Expanded floating chat — full toggle bar */
          <div className={cn("rounded-t-2xl overflow-hidden backdrop-blur-xl shadow-2xl md:border-t md:border-x md:border", pd ? "md:border-white/10 bg-[#1a1f2e]/95" : "md:border-slate-200 bg-slate-50/95")}>
            {/* Mobile close handle */}
            <div className="md:hidden flex items-center justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-white/20" />
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="absolute top-3 right-3 md:hidden p-1.5 rounded-full bg-slate-200/80 dark:bg-white/10"
            >
              <X className="h-4 w-4 text-slate-500 dark:text-white/60" />
            </button>
            <ContextTagsBar tags={contextTags} onRemove={removeContextTag} />
            <div className="flex items-center justify-between px-3 py-1">
              <button
                onClick={() => setChatOpen(false)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Collapse</span>
              </button>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowToolsInfo(true)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="AI Tools info"
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
                {sidebarToggleButton}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatKey((k) => k + 1)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="New chat"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className={cn(
          "overflow-hidden",
          expanded || chatPosition === "corner"
            ? "flex-1"
            : cn(
                cn("rounded-b-2xl md:border-x md:border-b backdrop-blur-xl shadow-2xl transition-all duration-200", pd ? "md:border-white/10 bg-[#1a1f2e]/95" : "md:border-slate-200 bg-slate-50/95"),
                chatOpen ? "flex-1 min-h-0" : "h-0"
              )
        )}>
          <ChatInterface
            key={`portal-chat-${chatKey}`}
            apiEndpoint="/api/chat/portal"
            extraHeaders={extraHeaders}
            portalMode
            portalTitle={activeDoc?.title || portal.title}
            portalClientName={portal.client_name ?? undefined}
            portalBrandColor={brandAccent}
            portalLogoUrl={portal.logo_url ?? undefined}
            initialPrompt={pendingPrompt ?? undefined}
            onToolOutput={handleToolOutput}
            onAssistantText={setLastAIResponse}
            onVoiceToggle={toggleVoiceMode}
            voiceActive={voiceActive}
            lastAIResponse={lastAIResponse}
          />
        </div>
      </div>


    </div>
  );
}
