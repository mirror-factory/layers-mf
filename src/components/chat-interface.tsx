"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, Loader2, Bot, User,
  FileText, Mic, GitBranch, MessageSquare, HardDrive, Upload, Hash, Github,
  LayoutGrid, ThumbsUp, ThumbsDown, X,
} from "lucide-react";
import { AGENT_TEMPLATES, type AgentTemplate } from "@/lib/agents/templates";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { SourceCitation, type CitationSource } from "@/components/chat/source-citation";

const MODELS = [
  { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet" },
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "google/gemini-flash", label: "Gemini Flash" },
  { id: "google/gemini-pro", label: "Gemini Pro" },
] as const;

const CONTENT_ICON: Record<string, React.ElementType> = {
  meeting_transcript: Mic,
  document: FileText,
  issue: GitBranch,
  message: MessageSquare,
};

const SOURCE_LABEL: Record<string, string> = {
  "google-drive": "Drive",
  gdrive: "Drive",
  github: "GitHub",
  "github-app": "GitHub",
  slack: "Slack",
  granola: "Granola",
  linear: "Linear",
  upload: "Upload",
};

const SOURCE_ICON: Record<string, React.ElementType> = {
  "google-drive": HardDrive,
  gdrive: HardDrive,
  github: Github,
  "github-app": Github,
  slack: Hash,
  upload: Upload,
};

function getTextContent(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

function getToolParts(parts: { type: string }[]): ToolPart[] {
  return parts.filter((p) => p.type.startsWith("tool-")) as ToolPart[];
}

function getSearchSources(toolParts: ToolPart[]): CitationSource[] {
  const searchTool = [...toolParts]
    .reverse()
    .find((p) => p.type === "tool-search_context" && p.state === "output-available");
  if (!searchTool || !("output" in searchTool)) return [];
  return (searchTool.output as CitationSource[]) ?? [];
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round(score * 2000));
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary/50 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{score.toFixed(4)}</span>
    </div>
  );
}

function ToolCallCard({ part }: { part: ToolPart }) {
  const isDone = part.state === "output-available" || part.state === "output-error";
  const output = isDone && "output" in part ? part.output : undefined;
  const errorText = "errorText" in part ? part.errorText : undefined;
  const isDynamic = part.type === "dynamic-tool";

  return (
    <Tool defaultOpen={isDone}>
      {isDynamic ? (
        <ToolHeader
          type="dynamic-tool"
          state={part.state}
          toolName={"toolName" in part ? (part.toolName as string) : ""}
        />
      ) : (
        <ToolHeader
          type={part.type as `tool-${string}`}
          state={part.state}
        />
      )}
      <ToolContent>
        {"input" in part && <ToolInput input={part.input} />}
        {isDone && (
          <ToolOutput
            output={
              output !== undefined ? (
                <pre className="text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
                </pre>
              ) : null
            }
            errorText={errorText}
          />
        )}
      </ToolContent>
    </Tool>
  );
}

const FEEDBACK_REASONS = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "wrong_source", label: "Wrong source" },
  { value: "outdated", label: "Outdated info" },
  { value: "missing_context", label: "Missing context" },
] as const;

function MessageFeedback({
  messageId,
  conversationId,
}: {
  messageId: string;
  conversationId?: string | null;
}) {
  const [selected, setSelected] = useState<"positive" | "negative" | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [thanksVisible, setThanksVisible] = useState(false);

  const submitFeedback = useCallback(
    async (feedback: "positive" | "negative", reason?: string) => {
      try {
        await fetch("/api/chat/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            conversationId: conversationId ?? null,
            feedback,
            reason: reason ?? null,
          }),
        });
      } catch {
        // fire and forget
      }
    },
    [messageId, conversationId]
  );

  const handleThumbsUp = useCallback(() => {
    if (selected) return;
    setSelected("positive");
    setShowReasons(false);
    setThanksVisible(true);
    submitFeedback("positive");
    setTimeout(() => setThanksVisible(false), 2000);
  }, [selected, submitFeedback]);

  const handleThumbsDown = useCallback(() => {
    if (selected) return;
    setSelected("negative");
    setShowReasons(true);
  }, [selected]);

  const handleReason = useCallback(
    (reason: string) => {
      setShowReasons(false);
      setThanksVisible(true);
      submitFeedback("negative", reason);
      setTimeout(() => setThanksVisible(false), 2000);
    },
    [submitFeedback]
  );

  const handleSkipReason = useCallback(() => {
    setShowReasons(false);
    setThanksVisible(true);
    submitFeedback("negative");
    setTimeout(() => setThanksVisible(false), 2000);
  }, [submitFeedback]);

  return (
    <div className="flex items-center gap-1 mt-1">
      <div className={cn("flex items-center gap-0.5", !selected && "md:opacity-0 md:group-hover:opacity-100 transition-opacity")}>
        <button
          type="button"
          onClick={handleThumbsUp}
          disabled={!!selected}
          className={cn(
            "p-1 rounded hover:bg-accent transition-colors",
            selected === "positive"
              ? "text-green-600 dark:text-green-400"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Thumbs up"
          data-testid="feedback-thumbs-up"
        >
          <ThumbsUp className={cn("h-3.5 w-3.5", selected === "positive" && "fill-current")} />
        </button>
        <button
          type="button"
          onClick={handleThumbsDown}
          disabled={!!selected}
          className={cn(
            "p-1 rounded hover:bg-accent transition-colors",
            selected === "negative"
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Thumbs down"
          data-testid="feedback-thumbs-down"
        >
          <ThumbsDown className={cn("h-3.5 w-3.5", selected === "negative" && "fill-current")} />
        </button>
      </div>

      {showReasons && (
        <div className="flex items-center gap-1 flex-wrap" data-testid="feedback-reasons">
          {FEEDBACK_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => handleReason(r.value)}
              className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSkipReason}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1"
          >
            Skip
          </button>
        </div>
      )}

      {thanksVisible && (
        <span className="text-[10px] text-muted-foreground animate-in fade-in">
          Thanks for feedback
        </span>
      )}
    </div>
  );
}

interface ChatInterfaceProps {
  conversationId?: string | null;
  initialTemplateId?: string | null;
}

export function ChatInterface({ conversationId, initialTemplateId }: ChatInterfaceProps) {
  const [model, setModel] = useState<string>("anthropic/claude-haiku-4-5-20251001");
  const [input, setInput] = useState("");
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeTemplate, setActiveTemplate] = useState<AgentTemplate | null>(
    initialTemplateId ? AGENT_TEMPLATES.find((t) => t.id === initialTemplateId) ?? null : null,
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (conversationId) params.set("conversation_id", conversationId);
    const url = `/api/chat/history${params.toString() ? `?${params}` : ""}`;
    setInitialMessages(undefined);
    setHistoryLoaded(false);
    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((msgs: UIMessage[]) => {
        if (msgs.length > 0) setInitialMessages(msgs);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [conversationId]);

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { model, conversationId },
    }),
    onFinish: () => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  // Collect latest search sources from any assistant message's tool parts
  const latestSources = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const parts = m.parts as { type: string }[];
      const toolParts = getToolParts(parts);
      const sources = getSearchSources(toolParts);
      if (sources.length > 0) return sources;
    }
    return [];
  })();

  return (
    <div className="flex h-full overflow-hidden flex-col md:flex-row">
      {/* Left: chat thread */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!historyLoaded && (
            <div role="status" aria-label="Loading conversation" className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2 opacity-40" />
              <p className="text-xs">Loading conversation…</p>
            </div>
          )}

          {historyLoaded && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground">Ask anything about your team&apos;s knowledge</p>
              <p className="text-xs mt-1">Layers searches your documents, meetings, and notes to answer.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
                {[
                  "Summarize last week\u2019s meetings",
                  "What decisions were made about the roadmap?",
                  "Find documents about onboarding",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage({ text: prompt })}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const parts = m.parts as { type: string; text?: string }[];
            const text = getTextContent(parts);
            const toolParts = m.role === "assistant" ? getToolParts(parts) : [];
            const sources = getSearchSources(toolParts);

            if (!text && toolParts.length === 0 && m.role !== "user") return null;

            const isLastAssistant =
              m.role === "assistant" &&
              m === messages.filter((msg) => msg.role === "assistant").at(-1);
            const isStreaming = isLastAssistant && isLoading;

            return (
              <div key={m.id} data-testid={m.role === "user" ? "user-message" : "assistant-message"} className={cn("flex gap-3 group", m.role === "user" ? "max-w-3xl ml-auto flex-row-reverse" : "max-w-4xl")}>
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  {/* Tool call cards */}
                  {toolParts.length > 0 && (
                    <div className="space-y-2">
                      {toolParts.map((part, i) => (
                        <div key={i} data-testid="tool-call">
                          <ToolCallCard part={part} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text response */}
                  {text && (
                    <div
                      className={cn(
                        "rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {text}
                    </div>
                  )}

                  {/* Source citations */}
                  {sources.length > 0 && (
                    <SourceCitation sources={sources} />
                  )}

                  {/* Feedback buttons — assistant messages only, not while streaming */}
                  {m.role === "assistant" && !isStreaming && text && (
                    <MessageFeedback
                      messageId={m.id}
                      conversationId={conversationId}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
              <div className="rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">Researching…</div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error.message ?? "Something went wrong."}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3 sm:p-4">
          {/* Agent template pills */}
          <div className="flex flex-wrap items-center gap-1.5 max-w-3xl mx-auto mb-2">
            <button
              onClick={() => setActiveTemplate(null)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                !activeTemplate
                  ? "bg-primary text-primary-foreground"
                  : "border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              General
            </button>
            {AGENT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTemplate(activeTemplate?.id === t.id ? null : t)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activeTemplate?.id === t.id
                    ? "bg-primary text-primary-foreground"
                    : "border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Suggested queries for active template */}
          {activeTemplate && (
            <div className="flex flex-wrap items-center gap-1.5 max-w-3xl mx-auto mb-2">
              <span className="text-[10px] text-muted-foreground mr-1">Try:</span>
              {activeTemplate.suggestedQueries.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput("");
                    sendMessage({ text: q });
                    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                  }}
                  className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 max-w-3xl mx-auto sm:flex-row sm:gap-3">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full sm:w-36 shrink-0 text-xs h-9" data-testid="model-selector" aria-label="Select AI model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 sm:gap-3 flex-1">
              <textarea
                data-testid="chat-input"
                aria-label="Chat message input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your documents, meetings, or team…"
                rows={1}
                className="flex-1 resize-none rounded-lg border bg-background px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button type="button" size="icon" onClick={handleSend} disabled={isLoading || !input.trim()} data-testid="chat-submit" aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2 hidden sm:block">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* Right: context panel (hidden on mobile) */}
      <aside className="hidden lg:flex w-72 shrink-0 border-l flex-col bg-card">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Context Retrieved</p>
          {latestSources.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{latestSources.length} items</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {latestSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 text-center">
              <FileText className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs">Send a message to see which documents were retrieved.</p>
            </div>
          ) : (
            <div className="divide-y">
              {latestSources.map((s, i) => {
                const ContentIcon = CONTENT_ICON[s.content_type] ?? FileText;
                const SrcIcon = SOURCE_ICON[s.source_type] ?? FileText;
                return (
                  <div key={s.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5 shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug line-clamp-2">{s.title}</p>
                        {s.description_short && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                            {s.description_short}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <SrcIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {SOURCE_LABEL[s.source_type] ?? s.source_type}
                      </span>
                      <ContentIcon className="h-3 w-3 text-muted-foreground ml-1" />
                      <span className="text-[10px] text-muted-foreground">
                        {s.content_type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <ScoreBar score={s.rrf_score} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
