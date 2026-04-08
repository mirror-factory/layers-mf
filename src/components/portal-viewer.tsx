"use client";

import { useState, useRef, useCallback } from "react";
import {
  Expand,
  Shrink,
  Volume2,
  List,
  Pause,
  Play,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalData } from "@/app/portal/[token]/page";
import { PortalPdfViewer } from "@/components/portal-pdf-viewer";
import { PortalChat } from "@/components/portal-chat";

interface PortalViewerProps {
  portal: PortalData;
}

export function PortalViewer({ portal }: PortalViewerProps) {
  const [expanded, setExpanded] = useState(portal.default_expanded);
  const [distractionFree, setDistractionFree] = useState(portal.hide_chrome);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(portal.page_count ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Multi-document switching
  const documents = portal.documents ?? [];
  const [activeDocIndex, setActiveDocIndex] = useState(() => {
    const idx = documents.findIndex(d => d.is_active);
    return idx >= 0 ? idx : 0;
  });
  const activeDoc = documents[activeDocIndex];
  const activePdfUrl = activeDoc?.pdf_path || portal.pdf_url;

  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setAudioPlaying(!audioPlaying);
  }, [audioPlaying]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleTotalPages = useCallback((pages: number) => {
    setTotalPages(pages);
  }, []);

  const brandColor = portal.brand_color || "#34d399";

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        distractionFree && "portal-distraction-free"
      )}
    >
      {/* Audio element (hidden) */}
      {portal.audio_url && (
        <audio
          ref={audioRef}
          src={portal.audio_url}
          onEnded={() => setAudioPlaying(false)}
          preload="metadata"
        />
      )}

      {/* Header */}
      {!distractionFree && (
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[hsl(168,14%,5%)]/80 px-4 py-3 backdrop-blur-xl">
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
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Table of contents"
            >
              <List className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDistractionFree(!distractionFree)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Toggle distraction-free mode"
            >
              {distractionFree ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
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

      {/* Main content */}
      {expanded ? (
        /* Expanded: 65/35 split */
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[65%] border-r border-white/5">
            <PortalPdfViewer
              pdfUrl={activePdfUrl}
              textContent={portal.document_content}
              spread={false}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onTotalPages={handleTotalPages}
            />
          </div>
          <div className="flex w-[35%] flex-col">
            <PortalChat
              shareToken={portal.share_token}
              enabledTools={portal.enabled_tools ?? []}
              brandColor={brandColor}
              expanded={true}
              clientName={portal.client_name}
              documentTitle={portal.title}
            />
          </div>
        </div>
      ) : (
        /* Compact: stacked with sticky chat at bottom */
        <div className="relative flex flex-1 flex-col min-h-0">
          {/* PDF viewer — takes remaining space, scrollable */}
          <div className="flex-1 overflow-auto pb-[280px]">
            <PortalPdfViewer
              pdfUrl={activePdfUrl}
              textContent={portal.document_content}
              spread={true}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onTotalPages={handleTotalPages}
            />
          </div>

          {/* Sticky chat at bottom */}
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[hsl(168,14%,5%)]/95 backdrop-blur-xl">
            {/* Page indicator */}
            {totalPages > 0 && (
              <div className="flex justify-center py-1">
                <span className="text-[10px] text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            )}
            <PortalChat
              shareToken={portal.share_token}
              enabledTools={portal.enabled_tools ?? []}
              brandColor={brandColor}
              expanded={false}
              clientName={portal.client_name}
              documentTitle={portal.title}
            />
          </div>
        </div>
      )}
    </div>
  );
}
