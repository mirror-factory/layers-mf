"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "@/lib/utils";
import {
  MessageSquarePlus,
  Lightbulb,
  BarChart3,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextAction = "send_to_chat" | "explain" | "visualize" | "research";

export interface PdfControls {
  goToPrev: () => void;
  goToNext: () => void;
  goToPage?: (page: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  zoom: number;
  numPages: number;
  currentPage: number;
  showSpread: boolean;
}

interface PortalPdfViewerProps {
  pdfUrl: string | null;
  textContent: string | null;
  spread: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPages: (pages: number) => void;
  onControlsReady?: (controls: PdfControls) => void;
  /** Callback when user selects text and picks a bubble menu action */
  onTextAction?: (action: TextAction, text: string) => void;
  /** Text to highlight in the PDF (from chat tool or search) */
  highlightText?: string;
}

// ---------------------------------------------------------------------------
// Bubble Menu (appears on text selection)
// ---------------------------------------------------------------------------

interface BubbleMenuProps {
  position: { top: number; left: number };
  onAction: (action: TextAction) => void;
  onClose: () => void;
}

function BubbleMenu({ position, onAction, onClose }: BubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const actions: { action: TextAction; label: string; icon: React.ReactNode }[] = [
    { action: "send_to_chat", label: "Send to Chat", icon: <MessageSquarePlus className="h-3.5 w-3.5" /> },
    { action: "explain", label: "Explain", icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { action: "visualize", label: "Visualize", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { action: "research", label: "Research", icon: <Globe className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] flex items-center gap-0.5 rounded-lg border border-white/10 bg-[hsl(168,14%,8%)]/95 p-1 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%) translateY(-8px)",
      }}
    >
      {actions.map(({ action, label, icon }) => (
        <button
          key={action}
          onClick={() => onAction(action)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          title={label}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search Bar (for PDF text search with match navigation)
// ---------------------------------------------------------------------------

interface SearchBarProps {
  onSearch: (query: string) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onClose: () => void;
  matchIndex: number;
  totalMatches: number;
  visible: boolean;
}

function PdfSearchBar({ onSearch, onNavigate, onClose, matchIndex, totalMatches, visible }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
    }
  }, [visible]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        onNavigate("prev");
      } else {
        onSearch(query);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div className="absolute right-4 top-4 z-50 flex items-center gap-2 rounded-lg border border-white/10 bg-[hsl(168,14%,8%)]/95 px-3 py-2 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search in document..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.length >= 2) {
            onSearch(e.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
      {totalMatches > 0 && (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">
            {matchIndex + 1} of {totalMatches}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("prev")}
              className="h-6 w-6 text-muted-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("next")}
              className="h-6 w-6 text-muted-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
      {query && totalMatches === 0 && (
        <span className="text-xs text-muted-foreground">No matches</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setQuery("");
          onClose();
        }}
        className="h-6 w-6 text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Highlight helper: marks matching text spans in the PDF text layer
// ---------------------------------------------------------------------------

function highlightTextInDom(container: HTMLElement, searchText: string): HTMLElement[] {
  // Remove any existing highlights first
  clearHighlightsInDom(container);

  if (!searchText.trim()) return [];

  const textLayerElements = container.querySelectorAll(".react-pdf__Page__textContent span");
  const matchElements: HTMLElement[] = [];
  const lowerSearch = searchText.toLowerCase();

  textLayerElements.forEach((span) => {
    const el = span as HTMLElement;
    const text = el.textContent ?? "";
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(lowerSearch);

    if (idx !== -1) {
      // Wrap matching portion in a highlight mark
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + searchText.length);
      const after = text.slice(idx + searchText.length);

      el.innerHTML = "";
      if (before) el.appendChild(document.createTextNode(before));
      const mark = document.createElement("mark");
      mark.className = "portal-pdf-highlight";
      mark.textContent = match;
      el.appendChild(mark);
      if (after) el.appendChild(document.createTextNode(after));

      matchElements.push(mark);
    }
  });

  return matchElements;
}

function clearHighlightsInDom(container: HTMLElement) {
  const marks = container.querySelectorAll("mark.portal-pdf-highlight, mark.portal-pdf-highlight-active");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
      parent.normalize();
    }
  });
}

// ---------------------------------------------------------------------------
// Inner PDF Document (lazy-loaded react-pdf) — continuous scroll with
// virtualized rendering and IntersectionObserver page detection
// ---------------------------------------------------------------------------

/** Number of pages to render beyond the visible page in each direction */
const PAGE_BUFFER = 5;

function PdfDocumentInner({
  pdfUrl,
  spread,
  currentPage,
  onPageChange,
  onTotalPages,
  isMobile,
  containerWidth,
  zoom,
  scrollContainerRef,
}: {
  pdfUrl: string;
  spread: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPages: (pages: number) => void;
  isMobile: boolean;
  containerWidth: number;
  zoom: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Document, Page, pdfjs } = require("react-pdf");
  const [numPages, setNumPages] = useState<number>(0);
  const [ready, setReady] = useState(false);
  const [pageHeight, setPageHeight] = useState(1000); // estimated height per page
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const programmaticScrollRef = useRef(false);

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }, [pdfjs]);

  const showSpread = spread && !isMobile;

  const pageWidth = useMemo(() => {
    const padding = 48;
    const available = (containerWidth - padding) * zoom;
    if (showSpread) {
      return Math.min((available - 16) / 2, 600);
    }
    return Math.min(available, 800);
  }, [containerWidth, zoom, showSpread]);

  const onLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages);
      onTotalPages(pages);
      setReady(true);
    },
    [onTotalPages]
  );

  // Determine which pages to actually render (virtualized window)
  const visibleRange = useMemo(() => {
    if (numPages === 0) return { start: 1, end: 1 };
    const start = Math.max(1, currentPage - PAGE_BUFFER);
    const end = Math.min(numPages, currentPage + PAGE_BUFFER);
    return { start, end };
  }, [currentPage, numPages]);

  // Update estimated page height when first page renders
  const handlePageRenderSuccess = useCallback(() => {
    // Read actual rendered height from first visible page
    const firstRef = pageRefs.current.get(visibleRange.start);
    if (firstRef) {
      const h = firstRef.getBoundingClientRect().height;
      if (h > 0 && Math.abs(h - pageHeight) > 20) {
        setPageHeight(h);
      }
    }
  }, [visibleRange.start, pageHeight]);

  // IntersectionObserver to detect which page is in view
  useEffect(() => {
    if (!ready || numPages === 0) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (programmaticScrollRef.current) return;

        // Find the entry with the largest intersection ratio
        let bestPage = currentPage;
        let bestRatio = 0;

        for (const entry of entries) {
          const pageNum = parseInt(entry.target.getAttribute("data-page-number") ?? "0", 10);
          if (pageNum > 0 && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestPage = pageNum;
          }
        }

        if (bestRatio > 0 && bestPage !== currentPage) {
          onPageChange(bestPage);
        }
      },
      {
        root: scrollContainer,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    // Observe all page sentinel divs
    pageRefs.current.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [ready, numPages, currentPage, onPageChange, scrollContainerRef]);

  // Smooth scroll to page when currentPage changes programmatically (prev/next buttons)
  const scrollToPage = useCallback(
    (page: number) => {
      const el = pageRefs.current.get(page);
      if (el) {
        programmaticScrollRef.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Release the programmatic scroll lock after animation
        setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 600);
      }
    },
    []
  );

  // Expose scrollToPage via a ref stored on the scroll container for the parent
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      (container as HTMLDivElement & { __scrollToPage?: (page: number) => void }).__scrollToPage = scrollToPage;
    }
  }, [scrollToPage, scrollContainerRef]);

  // Build page items for single or spread mode
  const pageItems = useMemo(() => {
    if (!showSpread) {
      // Single page mode: one item per page
      return Array.from({ length: numPages }, (_, i) => ({
        key: i + 1,
        pages: [i + 1],
      }));
    }
    // Spread mode: pairs of pages (1 alone, then 2-3, 4-5, ...)
    const items: { key: number; pages: number[] }[] = [];
    // First page alone
    if (numPages >= 1) {
      items.push({ key: 1, pages: [1] });
    }
    for (let i = 2; i <= numPages; i += 2) {
      const pair = [i];
      if (i + 1 <= numPages) pair.push(i + 1);
      items.push({ key: i, pages: pair });
    }
    return items;
  }, [numPages, showSpread]);

  // Calculate which items to render (virtualized)
  const renderedItems = useMemo(() => {
    return pageItems.filter((item) => {
      const firstPage = item.pages[0];
      const lastPage = item.pages[item.pages.length - 1];
      // Render if any page in the item is within the buffer range
      return lastPage >= visibleRange.start && firstPage <= visibleRange.end;
    });
  }, [pageItems, visibleRange]);

  // Calculate placeholder heights for non-rendered items
  const gapSize = 24; // gap between page items in px
  const itemHeight = showSpread ? pageHeight : pageHeight;

  const beforeHeight = useMemo(() => {
    if (renderedItems.length === 0 || pageItems.length === 0) return 0;
    const firstRenderedIdx = pageItems.indexOf(renderedItems[0]);
    return firstRenderedIdx * (itemHeight + gapSize);
  }, [renderedItems, pageItems, itemHeight, gapSize]);

  const afterHeight = useMemo(() => {
    if (renderedItems.length === 0 || pageItems.length === 0) return 0;
    const lastRenderedIdx = pageItems.indexOf(renderedItems[renderedItems.length - 1]);
    const remaining = pageItems.length - 1 - lastRenderedIdx;
    return remaining * (itemHeight + gapSize);
  }, [renderedItems, pageItems, itemHeight, gapSize]);

  const setPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(page, el);
    } else {
      pageRefs.current.delete(page);
    }
  }, []);

  return (
    <Document
      file={pdfUrl}
      onLoadSuccess={onLoadSuccess}
      loading={
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
      }
      error={
        <div className="flex items-center justify-center py-24 text-sm text-red-400">
          Failed to load PDF. Please try again.
        </div>
      }
    >
      {ready && (
        <div className="flex flex-col items-center gap-6">
          {/* Top spacer for virtualized pages above */}
          {beforeHeight > 0 && <div style={{ height: beforeHeight, flexShrink: 0 }} />}

          {renderedItems.map((item) => {
            const firstPage = item.pages[0];
            return (
              <div
                key={item.key}
                ref={(el) => setPageRef(firstPage, el)}
                data-page-number={firstPage}
                className={cn(
                  "flex gap-4",
                  showSpread ? "flex-row justify-center" : "flex-col items-center"
                )}
              >
                {item.pages.map((pageNum) => (
                  <div key={pageNum} className="rounded-sm bg-white shadow-2xl">
                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      renderTextLayer={true}
                      renderAnnotationLayer={false}
                      onRenderSuccess={pageNum === firstPage ? handlePageRenderSuccess : undefined}
                    />
                  </div>
                ))}
              </div>
            );
          })}

          {/* Bottom spacer for virtualized pages below */}
          {afterHeight > 0 && <div style={{ height: afterHeight, flexShrink: 0 }} />}
        </div>
      )}
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Main PortalPdfViewer
// ---------------------------------------------------------------------------

export function PortalPdfViewer({
  pdfUrl,
  textContent,
  spread,
  currentPage,
  onPageChange,
  onTotalPages,
  onControlsReady,
  onTextAction,
  highlightText: highlightTextProp,
}: PortalPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Bubble menu state
  const [bubbleMenu, setBubbleMenu] = useState<{
    position: { top: number; left: number };
    text: string;
  } | null>(null);

  // Search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchMatches, setSearchMatches] = useState<HTMLElement[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  const showSpread = spread && !isMobile;

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Lazy load react-pdf only when needed
  useEffect(() => {
    if (pdfUrl) {
      setPdfLoaded(true);
    }
  }, [pdfUrl]);

  const handleTotalPages = useCallback(
    (pages: number) => {
      setNumPages(pages);
      onTotalPages(pages);
    },
    [onTotalPages]
  );

  const goToPrev = useCallback(() => {
    const step = showSpread ? 2 : 1;
    const newPage = Math.max(1, currentPage - step);
    onPageChange(newPage);
    // Smooth scroll to the target page
    const container = pdfAreaRef.current as (HTMLDivElement & { __scrollToPage?: (page: number) => void }) | null;
    container?.__scrollToPage?.(newPage);
  }, [currentPage, onPageChange, showSpread]);

  const goToNext = useCallback(() => {
    const step = showSpread ? 2 : 1;
    const newPage = Math.min(numPages, currentPage + step);
    onPageChange(newPage);
    const container = pdfAreaRef.current as (HTMLDivElement & { __scrollToPage?: (page: number) => void }) | null;
    container?.__scrollToPage?.(newPage);
  }, [currentPage, numPages, onPageChange, showSpread]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 3)), []);
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(z - 0.25, 0.5)),
    []
  );
  const resetZoom = useCallback(() => setZoom(1), []);

  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(page, numPages));
    onPageChange(clamped);
    const container = pdfAreaRef.current as (HTMLDivElement & { __scrollToPage?: (page: number) => void }) | null;
    container?.__scrollToPage?.(clamped);
  }, [numPages, onPageChange]);

  // Expose controls to parent
  useEffect(() => {
    onControlsReady?.({
      goToPrev,
      goToNext,
      goToPage,
      zoomIn,
      zoomOut,
      resetZoom,
      zoom,
      numPages,
      currentPage,
      showSpread,
    });
  }, [onControlsReady, goToPrev, goToNext, goToPage, zoomIn, zoomOut, resetZoom, zoom, numPages, currentPage, showSpread]);

  // ---- Bubble Menu: Listen for text selection on the PDF area ----
  useEffect(() => {
    const pdfArea = pdfAreaRef.current;
    if (!pdfArea) return;

    const handleSelectionEnd = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (!selectedText || selectedText.length < 3) {
        // Don't show bubble menu for very short selections
        return;
      }

      // Check that the selection is within the PDF area
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (!pdfArea.contains(range.commonAncestorContainer)) {
          return;
        }
        const rect = range.getBoundingClientRect();
        setBubbleMenu({
          position: {
            top: rect.top,
            left: rect.left + rect.width / 2,
          },
          text: selectedText,
        });
      }
    };

    const handleMouseUp = () => {
      // Small delay to let the selection settle
      setTimeout(handleSelectionEnd, 10);
    };

    const handleTouchEnd = () => {
      setTimeout(handleSelectionEnd, 100);
    };

    pdfArea.addEventListener("mouseup", handleMouseUp);
    pdfArea.addEventListener("touchend", handleTouchEnd);

    return () => {
      pdfArea.removeEventListener("mouseup", handleMouseUp);
      pdfArea.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const handleBubbleAction = useCallback(
    (action: TextAction) => {
      if (bubbleMenu && onTextAction) {
        onTextAction(action, bubbleMenu.text);
      }
      setBubbleMenu(null);
      window.getSelection()?.removeAllRanges();
    },
    [bubbleMenu, onTextAction]
  );

  const closeBubbleMenu = useCallback(() => {
    setBubbleMenu(null);
  }, []);

  // ---- Search: keyboard shortcut (Ctrl/Cmd+F) ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        // Only intercept when the PDF viewer is focused/visible
        if (containerRef.current) {
          e.preventDefault();
          setSearchVisible(true);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search in DOM text layer
  const handleSearch = useCallback(
    (query: string) => {
      if (!pdfAreaRef.current || !query.trim()) {
        setSearchMatches([]);
        setSearchMatchIndex(0);
        return;
      }
      const matches = highlightTextInDom(pdfAreaRef.current, query);
      setSearchMatches(matches);
      setSearchMatchIndex(0);

      // Scroll to first match
      if (matches.length > 0) {
        matches[0].classList.add("portal-pdf-highlight-active");
        matches[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    []
  );

  const handleSearchNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (searchMatches.length === 0) return;

      // Remove active class from current
      searchMatches[searchMatchIndex]?.classList.remove("portal-pdf-highlight-active");

      let newIndex: number;
      if (direction === "next") {
        newIndex = (searchMatchIndex + 1) % searchMatches.length;
      } else {
        newIndex = (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
      }

      setSearchMatchIndex(newIndex);
      searchMatches[newIndex]?.classList.add("portal-pdf-highlight-active");
      searchMatches[newIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [searchMatches, searchMatchIndex]
  );

  const handleSearchClose = useCallback(() => {
    setSearchVisible(false);
    setSearchMatches([]);
    setSearchMatchIndex(0);
    if (pdfAreaRef.current) {
      clearHighlightsInDom(pdfAreaRef.current);
    }
  }, []);

  // ---- Highlight text from chat tool (highlightText prop) ----
  useEffect(() => {
    if (!highlightTextProp || !pdfAreaRef.current) return;

    // Small delay to ensure the text layer has rendered
    const timer = setTimeout(() => {
      if (!pdfAreaRef.current) return;
      const matches = highlightTextInDom(pdfAreaRef.current, highlightTextProp);
      setSearchMatches(matches);
      setSearchMatchIndex(0);

      if (matches.length > 0) {
        matches[0].classList.add("portal-pdf-highlight-active");
        matches[0].scrollIntoView({ behavior: "smooth", block: "center" });
        // Show the search bar so user can navigate matches
        setSearchVisible(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [highlightTextProp]);

  // If no PDF URL, render text content
  if (!pdfUrl) {
    return (
      <div ref={containerRef} className="flex flex-1 flex-col overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {textContent ? (
            <div className="prose prose-invert prose-sm max-w-none">
              {textContent.split("\n").map((line, i) => {
                if (!line.trim()) return <br key={i} />;
                if (line.startsWith("# ")) {
                  return (
                    <h1 key={i} className="mb-4 mt-8 text-2xl font-bold">
                      {line.slice(2)}
                    </h1>
                  );
                }
                if (line.startsWith("## ")) {
                  return (
                    <h2 key={i} className="mb-3 mt-6 text-xl font-semibold">
                      {line.slice(3)}
                    </h2>
                  );
                }
                if (line.startsWith("### ")) {
                  return (
                    <h3 key={i} className="mb-2 mt-4 text-lg font-medium">
                      {line.slice(4)}
                    </h3>
                  );
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return (
                    <li key={i} className="ml-4">
                      {line.slice(2)}
                    </li>
                  );
                }
                return (
                  <p key={i} className="mb-2 leading-relaxed text-gray-300">
                    {line}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              No document content available.
            </div>
          )}
        </div>
      </div>
    );
  }

  // PDF Viewer with continuous scroll, bubble menu and search
  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
      {/* Search bar overlay */}
      <PdfSearchBar
        visible={searchVisible}
        onSearch={handleSearch}
        onNavigate={handleSearchNavigate}
        onClose={handleSearchClose}
        matchIndex={searchMatchIndex}
        totalMatches={searchMatches.length}
      />

      {/* PDF Document — scrollable container */}
      <div ref={pdfAreaRef} className="relative flex-1 overflow-auto bg-[hsl(168,14%,3%)] p-6">
        <div className="flex items-start justify-center">
          {pdfLoaded && (
            <PdfDocumentInner
              pdfUrl={pdfUrl}
              spread={spread}
              currentPage={currentPage}
              onPageChange={onPageChange}
              onTotalPages={handleTotalPages}
              isMobile={isMobile}
              containerWidth={containerWidth}
              zoom={zoom}
              scrollContainerRef={pdfAreaRef}
            />
          )}
        </div>
      </div>

      {/* Bubble Menu */}
      {bubbleMenu && (
        <BubbleMenu
          position={bubbleMenu.position}
          onAction={handleBubbleAction}
          onClose={closeBubbleMenu}
        />
      )}
    </div>
  );
}
