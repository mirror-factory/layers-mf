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
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Search,
  Navigation,
  BarChart3,
  Globe,
  Highlighter,
  FileText,
  BookOpen,
  X,
  Play,
  Download,
  Settings2,
  MessageSquarePlus,
  StickyNote,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
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
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-white/5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
          Context
        </span>
        {tags.map((tag) => (
          <Tooltip key={tag.id}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/15">
                <span className="max-w-[160px] truncate">
                  {truncateText(tag.text)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(tag.id);
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-500/20 transition-colors"
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
  walkthrough_document: {
    label: "Walkthrough",
    icon: Play,
    description: "Animated document walkthrough",
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
// Presentation Overlay — fullscreen slide-by-slide PDF view
// ---------------------------------------------------------------------------

interface PresentationOverlayProps {
  pdfUrl: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onExit: () => void;
  brandColor: string;
}

function PresentationOverlay({ pdfUrl, currentPage, totalPages, onPageChange, onExit, brandColor }: PresentationOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Measure container
  useEffect(() => {
    const measure = () => {
      setContainerSize({ width: window.innerWidth, height: window.innerHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (currentPage < totalPages) onPageChange(currentPage + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentPage > 1) onPageChange(currentPage - 1);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages, onPageChange, onExit]);

  // Click to advance
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't advance if clicking on controls
    if (target.closest("button")) return;
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  }, [currentPage, totalPages, onPageChange]);

  // Lazy-load react-pdf for presentation — keep Document mounted, only change Page
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfLib = useMemo(() => {
    const { Document, Page, pdfjs } = require("react-pdf");
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    return { Document, Page };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page sized for presentation — landscape-friendly, max 900px wide
  const padding = 48;
  const maxWidth = Math.min(containerSize.width - padding * 2, 900);
  const maxHeight = containerSize.height - 100;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black cursor-pointer"
      onClick={handleClick}
    >
      {/* Navigation buttons — left/right edges */}
      <button
        onClick={(e) => { e.stopPropagation(); if (currentPage > 1) onPageChange(currentPage - 1); }}
        disabled={currentPage <= 1}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/60 hover:bg-white/20 hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none backdrop-blur-sm"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); if (currentPage < totalPages) onPageChange(currentPage + 1); }}
        disabled={currentPage >= totalPages}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/60 hover:bg-white/20 hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none backdrop-blur-sm"
        aria-label="Next slide"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Exit button — top right */}
      <button
        onClick={(e) => { e.stopPropagation(); onExit(); }}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white transition-all backdrop-blur-sm"
        aria-label="Exit presentation (Esc)"
      >
        <X className="h-5 w-5" />
      </button>

      {/* PDF Page — centered, Document stays mounted, only Page changes */}
      <div className="flex items-center justify-center">
        {pdfUrl && (
          <pdfLib.Document file={pdfUrl} key="presentation-doc" loading={null} error={null}>
            <div className="transition-opacity duration-200">
              <pdfLib.Page
                pageNumber={currentPage}
                width={maxWidth}
                height={maxHeight}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-2xl"
              />
            </div>
          </pdfLib.Document>
        )}
      </div>

      {/* Page indicator — bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
        <span className="text-sm font-medium text-white/80 tabular-nums">
          {currentPage} / {totalPages}
        </span>
        {/* Progress bar */}
        <div className="h-1 w-24 rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: totalPages > 0 ? `${(currentPage / totalPages) * 100}%` : "0%",
              backgroundColor: brandColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PortalViewer
// ---------------------------------------------------------------------------

interface PortalViewerProps {
  portal: PortalData;
}

export function PortalViewer({ portal }: PortalViewerProps) {
  const [expanded, setExpanded] = useState(portal.default_expanded);
  const [distractionFree, setDistractionFree] = useState(portal.hide_chrome);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(portal.page_count ?? 0);
  const [chatOpen, setChatOpen] = useState(false);
  const [pdfControls, setPdfControls] = useState<PdfControls | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const progressRef = useRef<HTMLDivElement | null>(null);

  // Context tags state
  const [contextTags, setContextTags] = useState<ContextTag[]>([]);

  // Highlight text from chat tools
  const [highlightText, setHighlightText] = useState<string | undefined>(undefined);

  // Annotations state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Walkthrough state
  const [walkthrough, setWalkthrough] = useState<{
    sections: { page: number; title: string; note: string }[];
    currentIndex: number;
    playing: boolean;
  } | null>(null);

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
      } else if (toolName === "walkthrough_document" && Array.isArray(out.sections)) {
        const sections = out.sections as { page: number; title: string; note: string }[];
        if (sections.length > 0) {
          setWalkthrough({ sections, currentIndex: 0, playing: true });
          // Navigate to first section
          const first = sections[0];
          if (pdfControls) {
            pdfControls.goToPage?.(first.page);
          }
          setCurrentPage(first.page);
          addAnnotation({
            page: first.page,
            text: first.title,
            note: first.note,
            type: "info",
          });
        }
      }
    },
    [addAnnotation, pdfControls]
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
  const activePdfUrl = activeDoc?.pdf_path || portal.pdf_url;

  // Feature 1: TOC — rebuild when switching documents
  const activeDocContent = useMemo(() => {
    const doc = documents[activeDocIndex];
    return doc?.content || portal.document_content;
  }, [documents, activeDocIndex, portal.document_content]);

  const tocEntries = useMemo(
    () => extractToc(activeDocContent, totalPages),
    [activeDocContent, totalPages]
  );

  const handleTocNavigate = useCallback((page: number) => {
    if (pdfControls) {
      pdfControls.goToPage?.(page);
    }
    setCurrentPage(page);
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
    // Don't let the PDF viewer's IntersectionObserver override during presentation
    if (presentationMode) return;
    setCurrentPage(page);
  }, [presentationMode]);

  const handleTotalPages = useCallback((pages: number) => {
    setTotalPages(pages);
  }, []);

  // Walkthrough auto-advance effect
  useEffect(() => {
    if (!walkthrough?.playing) return;
    const timer = setInterval(() => {
      setWalkthrough((prev) => {
        if (!prev || prev.currentIndex >= prev.sections.length - 1) {
          return prev ? { ...prev, playing: false } : null;
        }
        const next = prev.currentIndex + 1;
        const section = prev.sections[next];
        // Navigate to next section's page
        if (pdfControls) {
          pdfControls.goToPage?.(section.page);
        }
        setCurrentPage(section.page);
        // Add annotation for this section
        addAnnotation({
          page: section.page,
          text: section.title,
          note: section.note,
          type: "info",
        });
        return { ...prev, currentIndex: next };
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [walkthrough?.playing, pdfControls, addAnnotation]);

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

  const brandColor = portal.brand_color || "#34d399";

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
          onClick={() => { handleTocNavigate(entry.estimatedPage); if (typeof window !== "undefined" && window.innerWidth < 768) setShowToc(false); }}
          className={cn(
            "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/5",
            entry.estimatedPage === currentPage
              ? "bg-white/5 text-foreground"
              : "text-muted-foreground hover:text-foreground"
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
      <div className="fixed inset-0 z-[100] flex flex-col bg-[hsl(168,14%,5%)]/95 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
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
      <div className="hidden md:block w-64 shrink-0 overflow-y-auto border-r border-white/5 bg-[hsl(168,14%,5%)]/60 backdrop-blur-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[hsl(168,14%,5%)]/80 px-3 py-2 backdrop-blur-xl">
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
    <div className="flex items-center gap-2 mr-2 border-r border-white/10 pr-2">
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

  const handlePresentationPageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return (
    <div
      className={cn(
        "flex h-screen flex-col overflow-hidden",
        distractionFree && "portal-distraction-free"
      )}
    >
      {/* Welcome modal */}
      <PortalWelcomeModal
        clientName={portal.client_name ?? "Guest"}
        brandColor={brandColor}
        logoUrl={portal.logo_url}
      />

      {/* Presentation mode overlay */}
      {presentationMode && (
        <PresentationOverlay
          pdfUrl={activePdfUrl}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePresentationPageChange}
          onExit={() => setPresentationMode(false)}
          brandColor={brandColor}
        />
      )}

      {/* Audio element (hidden) */}
      {portal.audio_url && (
        <audio
          ref={audioRef}
          src={portal.audio_url}
          onEnded={() => setAudioPlaying(false)}
          preload="metadata"
        />
      )}

      {/* Unified Header — includes PDF page nav + zoom controls */}
      {!distractionFree && (
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[hsl(168,14%,5%)]/80 px-4 py-2 backdrop-blur-xl">
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
                <h1 className="text-base font-semibold tracking-tight">
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
              {/* Document switcher tabs */}
              {documents.length > 1 && (
                <div className="flex gap-1 mt-1">
                  {documents.map((doc, i) => (
                    <button
                      key={doc.id}
                      onClick={() => { setActiveDocIndex(i); setCurrentPage(1); }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                        i === activeDocIndex
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                      style={i === activeDocIndex ? { backgroundColor: brandColor } : undefined}
                    >
                      {doc.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* PDF page navigation — merged into header */}
            {pdfControls && pdfControls.numPages > 0 && (
              <div className="flex items-center gap-0.5 mr-2 border-r border-white/10 pr-2">
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

            {/* Zoom controls — merged into header, hidden on mobile */}
            {pdfControls && pdfControls.numPages > 0 && (
              <div className="hidden md:flex items-center gap-0.5 mr-2 border-r border-white/10 pr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={pdfControls.zoomOut}
                  disabled={pdfControls.zoom <= 0.5}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <button
                  onClick={pdfControls.resetZoom}
                  className="min-w-[40px] rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-white/5 tabular-nums"
                >
                  {Math.round(pdfControls.zoom * 100)}%
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={pdfControls.zoomIn}
                  disabled={pdfControls.zoom >= 3}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
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
              onClick={() => setShowToc(!showToc)}
              className={cn(
                "h-8 w-8 text-muted-foreground hover:text-foreground",
                showToc && "bg-white/10 text-foreground"
              )}
              title="Table of contents"
            >
              <List className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDistractionFree(!distractionFree)}
              className="hidden md:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Toggle distraction-free mode"
            >
              {distractionFree ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>

            {/* Presentation mode */}
            {activePdfUrl && totalPages > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPresentationMode(true)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Presentation mode"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}

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
      )}

      {/* Distraction-free: floating controls */}
      {distractionFree && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-1 rounded-lg border border-white/5 bg-[hsl(168,14%,5%)]/80 p-1 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDistractionFree(false)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Show header"
          >
            <Eye className="h-4 w-4" />
          </Button>
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
      )}

      {/* PDF viewer area */}
      <div className="flex flex-1 overflow-hidden" style={{ height: distractionFree ? '100vh' : 'calc(100vh - 3rem)' }}>
        {tocPanel}
        <div className={cn(
          "relative overflow-y-auto h-full transition-all duration-300",
          expanded ? "w-[65%] border-r border-white/5" : "flex-1 pb-20"
        )}>
          {/* Walkthrough progress bar */}
          {walkthrough && (
            <div className="absolute top-0 left-0 right-0 z-30 bg-black/80 backdrop-blur px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-white/80 shrink-0">
                Section {walkthrough.currentIndex + 1} of {walkthrough.sections.length}
              </span>
              <span className="text-xs text-white font-medium truncate max-w-[200px]">
                {walkthrough.sections[walkthrough.currentIndex]?.title}
              </span>
              <div className="flex-1 h-1 bg-white/10 rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((walkthrough.currentIndex + 1) / walkthrough.sections.length) * 100}%`,
                    backgroundColor: brandColor,
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setWalkthrough((w) =>
                    w ? { ...w, playing: !w.playing } : null
                  )
                }
                className="h-6 w-6 text-white/80 hover:text-white"
                title={walkthrough.playing ? "Pause walkthrough" : "Resume walkthrough"}
              >
                {walkthrough.playing ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  // Skip to next section manually
                  setWalkthrough((prev) => {
                    if (!prev || prev.currentIndex >= prev.sections.length - 1) {
                      return prev ? { ...prev, playing: false } : null;
                    }
                    const next = prev.currentIndex + 1;
                    const section = prev.sections[next];
                    if (pdfControls) pdfControls.goToPage?.(section.page);
                    setCurrentPage(section.page);
                    addAnnotation({
                      page: section.page,
                      text: section.title,
                      note: section.note,
                      type: "info",
                    });
                    return { ...prev, currentIndex: next };
                  });
                }}
                className="h-6 w-6 text-white/80 hover:text-white"
                title="Skip to next section"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWalkthrough(null)}
                className="h-6 w-6 text-white/80 hover:text-white"
                title="End walkthrough"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <PortalPdfViewer
            pdfUrl={activePdfUrl}
            textContent={portal.document_content}
            spread={!expanded}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onTotalPages={handleTotalPages}
            onControlsReady={handleControlsReady}
            onTextAction={handleTextAction}
            highlightText={highlightText}
          />
          {/* Annotation overlay — rendered on top of PDF pages */}
          <AnnotationOverlay
            annotations={annotations}
            onDismiss={dismissAnnotation}
            currentPage={currentPage}
            totalPages={totalPages}
          />
        </div>

        {/* Chat sidebar — only visible when expanded, animates in */}
        <div className={cn(
          "flex flex-col h-full min-h-0 overflow-hidden border-l border-white/5 transition-all duration-300",
          expanded ? "w-[35%]" : "w-0"
        )}>
          {expanded && (
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 shrink-0">
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
            ? "right-0 top-12 w-[35%] bottom-0 bg-[hsl(168,14%,5%)] border-l border-white/5"
            : cn(
                "bottom-4 left-1/2 -translate-x-1/2 w-full max-w-3xl px-2 md:px-4",
                distractionFree && "opacity-80 hover:opacity-100"
              )
        )}
      >
        {!expanded && !chatOpen && (
          /* Floating prompt bar — just the input + expand button */
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[hsl(168,14%,5%)]/95 backdrop-blur-xl shadow-2xl px-4 py-2.5">
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
          <div className="rounded-t-2xl border border-white/10 bg-[hsl(168,14%,5%)]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
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
                "rounded-b-2xl border-x border-b border-white/10 bg-[hsl(168,14%,5%)]/95 backdrop-blur-xl shadow-2xl transition-all duration-200",
                chatOpen ? "h-[40vh]" : "h-0"
              )
        )}>
          <ChatInterface
            key={`portal-chat-${chatKey}`}
            apiEndpoint="/api/chat/portal"
            extraHeaders={extraHeaders}
            portalMode
            portalTitle={activeDoc?.title || portal.title}
            portalClientName={portal.client_name ?? undefined}
            initialPrompt={pendingPrompt ?? undefined}
            onToolOutput={handleToolOutput}
          />
        </div>
      </div>

    </div>
  );
}
