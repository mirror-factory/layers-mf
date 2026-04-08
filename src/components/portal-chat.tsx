"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Send,
  Loader2,
  Search,
  BarChart3,
  Navigation,
  Globe,
  Highlighter,
  FileText,
  BookOpen,
  X,
  ChevronDown,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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
};

interface PortalChatProps {
  shareToken: string;
  enabledTools: string[];
  brandColor: string;
  expanded: boolean;
  clientName: string | null;
  documentTitle: string;
}

interface ContextTag {
  id: string;
  text: string;
  preview: string;
}

export function PortalChat({
  shareToken,
  enabledTools,
  brandColor,
  expanded,
  clientName,
  documentTitle,
}: PortalChatProps) {
  const [activeTools, setActiveTools] = useState<Set<string>>(
    () => new Set(enabledTools)
  );
  const [contextTags, setContextTags] = useState<ContextTag[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, stop } = useChat({
    id: `portal-${shareToken}`,
    transport: new DefaultChatTransport({
      api: "/api/chat/portal",
      headers: () => ({
        "x-share-token": shareToken,
        "x-active-tools": JSON.stringify(Array.from(activeTools)),
      }),
    }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Detect if user has scrolled up
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

  const removeContextTag = useCallback((id: string) => {
    setContextTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text && contextTags.length === 0) return;

    // Prepend context tags to the message
    let fullMessage = text;
    if (contextTags.length > 0) {
      const contextPrefix = contextTags
        .map((t) => `[Context: "${t.text}"]`)
        .join(" ");
      fullMessage = `${contextPrefix}\n\n${text}`;
      setContextTags([]);
    }

    sendMessage({ text: fullMessage });
    setInputValue("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "40px";
    }
  }, [inputValue, contextTags, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const extractTextContent = (message: typeof messages[number]): string => {
    if (!message.parts) return "";
    return message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  };

  return (
    <div
      className={cn(
        "relative flex flex-col",
        expanded ? "h-full" : "max-h-[420px]"
      )}
    >
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto px-4 py-3",
          expanded ? "min-h-0" : "max-h-[280px]"
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div
              className="mb-3 rounded-full p-3"
              style={{ backgroundColor: `${brandColor}15` }}
            >
              <FileText className="h-5 w-5" style={{ color: brandColor }} />
            </div>
            <p className="text-sm font-medium text-foreground">
              Ask about{" "}
              <span style={{ color: brandColor }}>{documentTitle}</span>
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {clientName
                ? `Chat with AI about ${clientName}'s document. Ask questions, search for sections, or request visualizations.`
                : "Chat with AI about this document. Ask questions, search for sections, or request visualizations."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                    message.role === "user"
                      ? "bg-white/10 text-foreground"
                      : "text-foreground"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>
                        {extractTextContent(message)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">
                      {extractTextContent(message)}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    style={{ color: brandColor }}
                  />
                  <span className="text-xs text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[hsl(168,14%,8%)] p-1.5 shadow-lg transition-colors hover:bg-[hsl(168,14%,12%)]"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Context tags */}
      {contextTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-4 py-2">
          {contextTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 bg-white/5 text-xs hover:bg-white/10"
            >
              <span className="max-w-[120px] truncate">{tag.text}</span>
              <button
                onClick={() => removeContextTag(tag.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tool toggles */}
      <div className="flex flex-wrap gap-1 border-t border-white/5 px-4 py-2">
        {enabledTools.map((toolId) => {
          const config = TOOL_CONFIG[toolId];
          if (!config) return null;
          const Icon = config.icon;
          const isActive = activeTools.has(toolId);

          return (
            <button
              key={toolId}
              onClick={() => toggleTool(toolId)}
              title={config.description}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                isActive
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground/60 hover:bg-white/5 hover:text-muted-foreground"
              )}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 border-t border-white/5 px-4 py-3">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about ${documentTitle}...`}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-white/20 focus:outline-none focus:ring-0"
          style={{
            minHeight: "40px",
            maxHeight: "120px",
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "40px";
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
        />

        {isStreaming ? (
          <Button
            type="button"
            onClick={() => stop()}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            style={{ backgroundColor: brandColor }}
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() && contextTags.length === 0}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl disabled:opacity-30"
            style={{
              backgroundColor: inputValue.trim() ? brandColor : undefined,
            }}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
