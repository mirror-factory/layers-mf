"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PdfControls {
  goToPrev: () => void;
  goToNext: () => void;
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
  spread: boolean; // two-page spread on desktop
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPages: (pages: number) => void;
  /** Callback to expose controls to parent so it can render them in the header */
  onControlsReady?: (controls: PdfControls) => void;
}

// Lazy-loaded react-pdf inner component
function PdfDocumentInner({
  pdfUrl,
  spread,
  currentPage,
  onPageChange,
  onTotalPages,
  isMobile,
  containerWidth,
  zoom,
}: {
  pdfUrl: string;
  spread: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPages: (pages: number) => void;
  isMobile: boolean;
  containerWidth: number;
  zoom: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Document, Page, pdfjs } = require("react-pdf");
  const [numPages, setNumPages] = useState<number>(0);
  const [ready, setReady] = useState(false);

  // Set up worker
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
        <div
          className={cn(
            "flex gap-4",
            showSpread ? "flex-row" : "flex-col items-center"
          )}
        >
          <div className="rounded-sm bg-white shadow-2xl">
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </div>
          {showSpread && currentPage + 1 <= numPages && (
            <div className="rounded-sm bg-white shadow-2xl">
              <Page
                pageNumber={currentPage + 1}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          )}
        </div>
      )}
    </Document>
  );
}

export function PortalPdfViewer({
  pdfUrl,
  textContent,
  spread,
  currentPage,
  onPageChange,
  onTotalPages,
  onControlsReady,
}: PortalPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

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
  }, [currentPage, onPageChange, showSpread]);

  const goToNext = useCallback(() => {
    const step = showSpread ? 2 : 1;
    const newPage = Math.min(numPages, currentPage + step);
    onPageChange(newPage);
  }, [currentPage, numPages, onPageChange, showSpread]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 3)), []);
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(z - 0.25, 0.5)),
    []
  );
  const resetZoom = useCallback(() => setZoom(1), []);

  // Expose controls to parent for rendering in the header
  useEffect(() => {
    onControlsReady?.({
      goToPrev,
      goToNext,
      zoomIn,
      zoomOut,
      resetZoom,
      zoom,
      numPages,
      currentPage,
      showSpread,
    });
  }, [onControlsReady, goToPrev, goToNext, zoomIn, zoomOut, resetZoom, zoom, numPages, currentPage, showSpread]);

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

  // PDF Viewer — controls are rendered by the parent (portal-viewer header)
  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
      {/* PDF Document */}
      <div className="flex-1 overflow-auto bg-[hsl(168,14%,3%)] p-6">
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
