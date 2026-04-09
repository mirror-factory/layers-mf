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
  Moon
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
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-sky-100 dark:border-white/5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
          Context
        </span>
        {tags.map((tag) => (
          <Tooltip key={tag.id}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-xs text-sky-600 transition-colors hover:bg-sky-400/15">
                <span className="max-w-[160px] truncate">
                  {truncateText(tag.text)}
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
// Tool config (mirrors portal-chat.tsx TOOL_CONFIG)
// ---------------------------------------------------------------------------

const TOOL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  search_document: {
    label: "Search",
    icon: Search,
    description: "Search within the document",
  },
  navigate_pdf: {
    label: "Navigate",
    icon: Navigation,
    description: "Navigate to pages/sections",
  },
  render_chart: {
    label: "Charts",
    icon: BarChart3,
    description: "Generate visualizations",
  },
  web_search: {
    label: "Web",
    icon: Globe,
    description: "Search the web",
  },
  highlight_text: {
    label: "Highlight",
    icon: Highlighter,
    description: "Highlight text in document",
  },
  get_page_content: {
    label: "Page",
    icon: FileText,
    description: "Get full page content",
  },
  summarize_section: {
    label: "Summarize",
    icon: BookOpen,
    description: "Summarize a section",
  },
  add_annotation: {
    label: "Annotate",
    icon: StickyNote,
    description: "Add visual callouts to PDF",
  },
};

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
  const [expanded, setExpanded] = useState(portal.default_expanded);
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
  const progressRef = useRef<HTMLDivElement | null>(null);

  // Context tags state
  const [contextTags, setContextTags] = useState<ContextTag[]>([]);

  // Highlight text from chat tools
  const [highlightText, setHighlightText] = useState<string | undefined>(undefined);

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
  const [activeView, setActiveView] = useState<"document" | "library" | "doc-preview">("document");
  const [previewDoc, setPreviewDoc] = useState<typeof BLUEWAVE_DOCUMENTS[0] | null>(null);
  const [docPreviewText, setDocPreviewText] = useState<string | null>(null);
  const [docPreviewHtml, setDocPreviewHtml] = useState<string | null>(null);
  const [docPreviewTable, setDocPreviewTable] = useState<string[][] | null>(null);
  const [docPreviewMessages, setDocPreviewMessages] = useState<string[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [docxArrayBuffer, setDocxArrayBuffer] = useState<ArrayBuffer | null>(null);
  const docxContainerRef = useRef<HTMLDivElement | null>(null);

  const handleOpenDocPreview = async (doc: typeof BLUEWAVE_DOCUMENTS[0], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPreviewDoc(doc);
    setActiveView("doc-preview");

    if (doc.type === "image" || doc.type === "pdf") {
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    setDocPreviewText(null);
    setDocPreviewHtml(null);
    setDocPreviewTable(null);
    setDocPreviewMessages([]);

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
        });
        const normalized = rows.map((row) => row.map((cell) => (cell ?? "").toString()));
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
        const page = Number(out.page);
        if (page > 0 && pdfControls) {
          pdfControls.goToPage?.(page);
          setCurrentPage(page);
        }
      } else if (toolName === "highlight_text" && out.action === "highlight") {
        setHighlightText(String(out.text ?? ""));
        const page = Number(out.page);
        if (page > 0 && pdfControls) {
          pdfControls.goToPage?.(page);
          setCurrentPage(page);
        }
      } else if (toolName === "open_document_preview" && out.action === "open_document_preview") {
        const docId = String(out.document_id ?? "");
        // Check library documents first, then portal documents
        const libraryDoc = BLUEWAVE_DOCUMENTS.find((item) => item.id === docId);
        if (libraryDoc) {
          void handleOpenDocPreview(libraryDoc);
        } else {
          // Try portal documents — switch to that doc tab
          const portalDocs = portal.documents ?? [];
          const portalIdx = portalDocs.findIndex(
            (d) => d.context_item_id === docId || d.title === docId || d.id === docId
          );
          if (portalIdx >= 0) {
            setActiveDocIndex(portalIdx);
            setActiveView("document");
            setCurrentPage(1);
            setPdfFailed(false);
          }
        }
      }
    },
    [addAnnotation, pdfControls, handleOpenDocPreview]
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
  const extraHeaders = useMemo(
    () => ({
      "x-portal-token": portal.share_token,
      "x-active-tools": JSON.stringify([...activeTools]),
      ...(contextTags.length > 0 && {
        "x-portal-context": JSON.stringify(contextTags.map((t) => t.text)),
      }),
    }),
    [portal.share_token, activeTools, contextTags]
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
    const docTitle = activeView === "doc-preview" && previewDoc
      ? previewDoc.title
      : activeDoc?.title;
    if (!docTitle) return;
    setContextTags(prev => {
      const filtered = prev.filter(t => !t.text.startsWith("Viewing: "));
      return [{ id: "active-doc", text: `Viewing: ${docTitle}` }, ...filtered];
    });
  }, [activeView, activeDocIndex, previewDoc?.title, activeDoc?.title]);

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

  const handleTextAction = useCallback(
    (action: TextAction, text: string) => {
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
      if (action === "send_to_chat") {
        addContextTag(text);
      } else if (action === "explain") {
        setPendingPrompt(`Explain this section: "${truncated}"`);
      } else if (action === "visualize") {
        setPendingPrompt(`Visualize this data as a chart: "${truncated}"`);
      } else if (action === "research") {
        setPendingPrompt(`Research and fact-check this claim: "${truncated}"`);
      }
      setChatOpen(true);
    },
    [addContextTag]
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
  const docPreviewIsLight = previewDoc?.type === "docx" || previewDoc?.type === "xlsx";

  // ---------------------------------------------------------------------------
  // Tool toggles dropdown menu (Bug 8)
  // ---------------------------------------------------------------------------
  const toolTogglesDropdown = (portal.enabled_tools ?? []).length > 0 ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Configure tools"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {(portal.enabled_tools ?? []).map((toolId) => {
          const config = TOOL_CONFIG[toolId];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <DropdownMenuCheckboxItem
              key={toolId}
              checked={activeTools.has(toolId)}
              onCheckedChange={() => toggleTool(toolId)}
            >
              <Icon className="mr-2 h-3.5 w-3.5" />
              {config.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

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
            pd ? "hover:bg-white/5" : "hover:bg-gray-100",
            activeTocId === entry.id
              ? pd ? "bg-white/5 text-foreground" : "bg-gray-100 text-gray-900"
              : (!activeTocId && entry.estimatedPage === currentPage)
                ? pd ? "bg-white/5 text-foreground" : "bg-gray-100 text-gray-900"
                : pd ? "text-muted-foreground hover:text-foreground" : "text-gray-500 hover:text-gray-900"
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
      <div className={cn("fixed inset-0 z-[100] flex flex-col backdrop-blur-xl md:hidden", pd ? "bg-[#070a0e]/95" : "bg-white/95")}>
        <div className={cn("flex items-center justify-between px-4 py-3 border-b", pd ? "border-white/5" : "border-sky-100")}>
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
      <div className={cn("hidden md:block w-64 shrink-0 overflow-y-auto backdrop-blur-xl border-r", pd ? "border-white/5 bg-[#070a0e]/60" : "border-sky-100 bg-white/70")}>
        <div className={cn("sticky top-0 z-10 flex items-center justify-between px-3 py-2 backdrop-blur-xl border-b", pd ? "border-white/5 bg-[#070a0e]/80" : "border-sky-100 bg-white/90")}>
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
    <div className={cn("flex items-center gap-2 mr-2 pr-2 border-r", pd ? "border-white/10" : "border-sky-100")}>
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
      className={cn("flex h-screen flex-col overflow-hidden", pd ? "bg-[#070a0e]" : "bg-gray-50")}
    >
      {/* Welcome modal */}
      <PortalWelcomeModal
        clientName={portal.client_name ?? "Guest"}
        brandColor={brandColor}
        logoUrl={portal.logo_url ?? undefined}
        isDark={portalDark}
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

      {/* Unified Header — includes PDF page nav */}
      <header className={cn(
        "sticky top-0 z-50 flex items-center justify-between px-4 py-2 backdrop-blur-xl",
        pd ? "border-b border-white/5 bg-[#070a0e]/80" : "border-b border-sky-100 bg-white/95"
      )}>
          <div className="flex items-center gap-3">
            {portal.logo_url && (
              <img
                src={portal.logo_url}
                alt="Logo"
                className="h-7 w-7 rounded-md object-contain"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className={cn("text-base font-semibold tracking-tight", pd ? "text-white" : "text-gray-900")}>
                  {activeDoc?.title || portal.title}
                </h1>
                {portal.client_name && (
                  <span
                    className="text-sm font-medium"
                    style={{ color: brandColor }}
                  >
                    {portal.client_name}
                  </span>
                )}
              </div>
              {/* Document switcher tabs (desktop) */}
              <div className="hidden md:flex gap-1 mt-1">
                <button
                  onClick={() => { setActiveView("library"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1",
                    activeView === "library" || activeView === "doc-preview"
                      ? "text-primary-foreground"
                      : pd ? "text-muted-foreground hover:text-foreground hover:bg-white/5" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  )}
                  style={activeView === "library" || activeView === "doc-preview" ? { backgroundColor: brandColor } : undefined}
                >
                  <FolderOpen className="h-3 w-3" /> Library
                </button>
                {documents.map((doc, i) => (
                  <button
                    key={doc.id}
                    onClick={() => { setActiveDocIndex(i); setActiveView("document"); setCurrentPage(1); setPdfFailed(false); }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                      i === activeDocIndex && activeView === "document"
                        ? "text-primary-foreground"
                        : pd ? "text-muted-foreground hover:text-foreground hover:bg-white/5" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    )}
                    style={i === activeDocIndex && activeView === "document" ? { backgroundColor: brandColor } : undefined}
                  >
                    {doc.title}
                  </button>
                ))}
              </div>

              {/* Mobile doc picker */}
              <div className="mt-2 md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 px-2 text-xs font-medium gap-2",
                        pd ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10" : "border-sky-100 bg-white text-slate-600"
                      )}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[140px]">
                        {activeView === "library" ? "Document Library" : activeDoc?.title || portal.title}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem
                      onClick={() => { setActiveView("library"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" /> Full document library
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {documents.map((doc, i) => (
                      <DropdownMenuItem
                        key={doc.id}
                        onClick={() => { setActiveDocIndex(i); setActiveView("document"); setCurrentPage(1); setPdfFailed(false); }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        <span className="truncate">{doc.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* PDF page navigation — merged into header */}
            {pdfControls && pdfControls.numPages > 0 && (
              <div className={cn("flex items-center gap-0.5 mr-2 pr-2 border-r", pd ? "border-white/10" : "border-sky-100")}>
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

            {/* Search button */}
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPortalDark((prev) => !prev)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={portalDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {portalDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowToc(!showToc)}
              className={cn(
                "h-8 w-8 text-muted-foreground hover:text-foreground",
                showToc && (pd ? "bg-white/10 text-foreground" : "bg-sky-50 text-sky-900")
              )}
              title="Table of contents"
            >
              <List className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatOpen((prev) => !prev)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
              title={chatOpen ? "Hide chat" : "Show chat"}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>

            {/* Download PDF */}
            {activePdfUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = activePdfUrl;
                  a.download = (activeDoc?.title || portal.title) + ".pdf";
                  a.click();
                }}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Download PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={expanded ? "Compact mode" : "Expanded mode"}
            >
              {expanded ? (
                <Shrink className="h-4 w-4" />
              ) : (
                <Expand className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

      {/* PDF viewer area */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 3rem)' }}>
        {activeView === "document" && tocPanel}
        
        {activeView === "doc-preview" && previewDoc ? (
          <div className={cn("flex-1 overflow-y-auto", pd ? "" : "bg-gray-50")}>
            {/* Sticky viewer header */}
            <div className={cn("sticky top-0 z-20 flex items-center justify-between backdrop-blur-xl px-4 py-3 border-b", pd ? "border-white/10 bg-[#0a0a0f]/95" : "border-sky-100 bg-white/95")}>
              <div className="flex items-center gap-3 overflow-hidden">
                <button
                  onClick={() => { setActiveView("library"); }}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors", pd ? "text-white/40 hover:text-white/80 hover:bg-white/5" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100")}
                  title="Back to Library"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: previewDoc.type === 'image' ? '#f59e0b15' : previewDoc.type === 'pdf' ? '#ef444415' : previewDoc.type === 'xlsx' ? '#22c55e15' : `${brandColor}15` }}>
                  {previewDoc.type === "image" ? <ImageIcon className="h-4 w-4 text-amber-500" /> :
                   previewDoc.type === "pdf" ? <FileIcon className="h-4 w-4 text-red-500" /> :
                   previewDoc.type === "xlsx" ? <FileSpreadsheet className="h-4 w-4 text-green-500" /> :
                   <FileText className="h-4 w-4 text-cyan-400" />}
                </div>
                <div className="overflow-hidden">
                  <p className={cn("truncate text-sm font-semibold", pd ? "text-white" : "text-gray-900")}>{previewDoc.title}</p>
                  <p className={cn("text-[10px]", pd ? "text-white/30" : "text-gray-400")}>{previewDoc.type.toUpperCase()} · {previewDoc.sizeHuman}</p>
                </div>
              </div>
              <a
                href={previewDoc.url}
                download
                className={cn("flex h-7 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition-all border", pd ? "border-white/10 text-white/60 hover:bg-white/10 hover:text-white" : "border-sky-100 text-gray-500 hover:bg-sky-50 hover:text-gray-800")}
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>

            {/* Viewer content */}
            <div className="p-6">
              {previewDoc.type === "image" ? (
                <div className="flex min-h-[70vh] items-center justify-center">
                  <img src={previewDoc.url} alt={previewDoc.title} className={cn("max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain border", pd ? "border-white/10" : "border-sky-100")} />
                </div>
              ) : previewDoc.type === "xlsx" ? (
                <div className="min-h-[60vh] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {docPreviewTable ? (
                    <div className="overflow-auto max-h-[80vh]">
                      <table className="min-w-full border-collapse text-left text-[13px] text-slate-700">
                        {docPreviewTable.length > 0 && (
                          <thead className="sticky top-0 z-10">
                            <tr>
                              {/* Row number header */}
                              <th className="border-b border-r border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-medium text-slate-400 w-10">#</th>
                              {docPreviewTable[0].map((cell, cellIdx) => (
                                <th
                                  key={`h-${cellIdx}`}
                                  className="border-b border-r border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-800 text-xs whitespace-nowrap"
                                >
                                  {cell || String.fromCharCode(65 + cellIdx)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {docPreviewTable.slice(1).map((row, rowIdx) => (
                            <tr key={`row-${rowIdx}`} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                              <td className="border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-medium text-slate-400 w-10">
                                {rowIdx + 2}
                              </td>
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={`cell-${rowIdx}-${cellIdx}`}
                                  className="border-b border-r border-slate-200 px-3 py-1.5 align-top whitespace-nowrap"
                                >
                                  {cell || ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-slate-500">
                      {docPreviewText || "Loading spreadsheet..."}
                    </div>
                  )}
                </div>
              ) : isPreviewLoading ? (
                <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-500" />
                  <p className={cn("text-sm", pd ? "text-white/50" : "text-gray-500")}>Loading document...</p>
                </div>
              ) : docxArrayBuffer && previewDoc.type === "docx" ? (
                /* docx-preview renders directly into this container */
                <div
                  ref={docxContainerRef}
                  className="docx-preview-wrapper mx-auto max-w-4xl min-h-[80vh] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
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
        ) : activeView === "library" ? (
          <div className={cn("flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-12 md:py-12", pd ? "" : "bg-gray-50")}>
            <div className="mx-auto max-w-5xl">
              <div className="mb-8">
                <h2 className={cn("text-3xl font-bold tracking-tight mb-2", pd ? "text-white" : "text-gray-900")}>Document Library</h2>
                <p className={cn(pd ? "text-gray-400" : "text-gray-500")}>Browse and download all configured documents for this project.</p>
              </div>
              
              {["Core Documents", "Planning", "Proposal Library", "Architecture"].map((category) => {
                const categoryDocs = BLUEWAVE_DOCUMENTS.filter(d => d.category === category);
                if (categoryDocs.length === 0) return null;
                
                return (
                  <div key={category} className="mb-10">
                    <h3 className={cn("mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider", pd ? "text-white/50" : "text-gray-400")}>
                      <FolderOpen className="h-4 w-4" /> {category}
                    </h3>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryDocs.map((doc, di) => (
                        <div
                          key={di}
                          onClick={() => handleOpenDocPreview(doc)}
                          className={cn("group relative flex flex-col items-start gap-4 rounded-xl p-5 transition-all duration-300 cursor-pointer border", pd ? "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]" : "border-sky-100 bg-white hover:border-sky-200 hover:bg-sky-50")}
                        >
                          <div className="flex w-full items-start justify-between gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105"
                              style={{ backgroundColor: doc.type === 'pdf' ? '#ef444415' : doc.type === 'xlsx' ? '#22c55e15' : doc.type === 'image' ? '#f59e0b15' : `${brandColor}15` }}>
                              {doc.type === "pdf" ? <FileIcon className="h-5 w-5 text-red-500" /> :
                               doc.type === "xlsx" ? <FileSpreadsheet className="h-5 w-5 text-green-500" /> :
                               doc.type === "image" ? <ImageIcon className="h-5 w-5 text-amber-500" /> :
                               <FileText className="h-5 w-5" style={{ color: brandColor }} />}
                            </div>

                            <div className="flex shrink-0 gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                              <a
                                href={doc.url}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className={cn("flex h-7 w-7 items-center justify-center rounded border transition-colors", pd ? "border-white/10 bg-black/20 text-white/70 hover:bg-white/10 hover:text-white" : "border-sky-100 bg-white text-gray-500 hover:bg-sky-50 hover:text-gray-800")}
                                title="Download Document"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                          
                          <div className="w-full">
                            <p className={cn("text-sm font-semibold line-clamp-2", pd ? "text-white" : "text-gray-900")} title={doc.title}>{doc.title}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                                doc.type === 'pdf' ? 'bg-red-500/10 text-red-400' :
                                doc.type === 'xlsx' ? 'bg-green-500/10 text-green-400' :
                                doc.type === 'image' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-cyan-500/10 text-cyan-400'
                              )}>
                                {doc.type}
                              </span>
                              <span className={cn("text-[11px]", pd ? "text-white/30" : "text-gray-400")}>{doc.sizeHuman}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={cn(
            "relative overflow-y-auto h-full transition-all duration-300",
            expanded ? cn("w-[65%] border-r", pd ? "border-white/5" : "border-sky-100") : "flex-1 pb-20",
            pd ? "" : "bg-gray-100"
          )}>
          <PortalPdfViewer
            pdfUrl={activePdfUrl}
            textContent={activeDocContent || portal.document_content}
            spread={!expanded}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onTotalPages={handleTotalPages}
            onControlsReady={handleControlsReady}
            onTextAction={handleTextAction}
            highlightText={highlightText}
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

        {/* Chat sidebar — only visible when expanded, animates in */}
        <div className={cn(
          "flex flex-col h-full min-h-0 overflow-hidden transition-all duration-300 border-l",
          pd ? "border-white/5" : "border-sky-100",
          expanded ? "w-[35%]" : "w-0"
        )}>
          {expanded && (
            <div className={cn("flex items-center justify-between px-3 py-1.5 shrink-0 border-b", pd ? "border-white/5" : "border-sky-100")}>
              <ContextTagsBar tags={contextTags} onRemove={removeContextTag} />
              <div className="flex items-center gap-1 shrink-0">
                {toolTogglesDropdown}
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
        </div>
      </div>

      {/* SINGLE ChatInterface — always mounted, positioned via CSS */}
      <div
        className={cn(
          "fixed z-40 flex flex-col",
          expanded
            ? cn("right-0 top-12 w-[35%] bottom-0 border-l", pd ? "bg-[#070a0e] border-white/5" : "bg-white border-sky-100")
            : cn(
                "left-0 right-0",
                chatOpen ? "top-12 bottom-0" : "bottom-0",
                "md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl md:px-4 md:top-auto"
              )
        )}
      >
        {!expanded && !chatOpen && (
          /* Floating prompt bar — just the input + expand button */
          <div className={cn("flex items-center gap-2 rounded-none md:rounded-2xl backdrop-blur-xl shadow-2xl px-4 py-2.5 pb-4 md:pb-2.5 border-t md:border", pd ? "border-white/10 bg-[#070a0e]/95" : "border-sky-100 bg-white/95")}>
            <button
              onClick={() => setChatOpen(true)}
              className="flex-1 text-left text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
            >
              Ask about this document...
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {toolTogglesDropdown}
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
        {!expanded && chatOpen && (
          /* Expanded floating chat — full toggle bar */
          <div className={cn("rounded-t-2xl overflow-hidden backdrop-blur-xl shadow-2xl border-t border-x md:border", pd ? "border-white/10 bg-[#070a0e]/95" : "border-sky-100 bg-white/95")}>
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
                {toolTogglesDropdown}
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
          expanded
            ? "flex-1"
            : cn(
                cn("rounded-b-2xl border-x border-b backdrop-blur-xl shadow-2xl transition-all duration-200", pd ? "border-white/10 bg-[#070a0e]/95" : "border-sky-100 bg-white/95"),
                chatOpen ? "flex-1 md:h-[40vh]" : "h-0"
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
          />
        </div>
      </div>


    </div>
  );
}
