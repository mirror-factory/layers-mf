"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, Bot, User,
  FileText, Mic, GitBranch, MessageSquare, HardDrive, Upload, Hash, Github,
  LayoutGrid,
} from "lucide-react";
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

function getSearchSources(toolParts: ToolPart[]) {
  const searchTool = [...toolParts]
    .reverse()
    .find((p) => p.type === "tool-search_context" && p.state === "output-available");
  if (!searchTool || !("output" in searchTool)) return [];
  return (searchTool.output as { id: string; title: string; source_type: string; content_type: string; rrf_score: number; description_short: string | null }[]) ?? [];
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

export function ChatInterface() {
  const [model, setModel] = useState<string>("anthropic/claude-haiku-4-5-20251001");
  const [input, setInput] = useState("");
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat/history")
      .then((res) => (res.ok ? res.json() : []))
      .then((msgs: UIMessage[]) => {
        if (msgs.length > 0) setInitialMessages(msgs);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, []);

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { model },
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
    <div className="flex h-full overflow-hidden">
      {/* Left: chat thread */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!historyLoaded && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2 opacity-40" />
              <p className="text-xs">Loading conversation…</p>
            </div>
          )}

          {historyLoaded && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Ask anything about your team&apos;s knowledge</p>
              <p className="text-xs mt-1">Layers searches your documents, meetings, and notes to answer.</p>
            </div>
          )}

          {messages.map((m) => {
            const parts = m.parts as { type: string; text?: string }[];
            const text = getTextContent(parts);
            const toolParts = m.role === "assistant" ? getToolParts(parts) : [];
            const sources = getSearchSources(toolParts);

            if (!text && toolParts.length === 0 && m.role !== "user") return null;

            return (
              <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "max-w-3xl ml-auto flex-row-reverse" : "max-w-4xl")}>
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
                        <ToolCallCard key={i} part={part} />
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

                  {/* Source chips */}
                  {sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {sources.slice(0, 4).map((s) => {
                        const Icon = CONTENT_ICON[s.content_type] ?? FileText;
                        return (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            <Icon className="h-2.5 w-2.5" />
                            <span className="max-w-[120px] truncate">{s.title}</span>
                          </span>
                        );
                      })}
                      {sources.length > 4 && (
                        <span className="inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                          +{sources.length - 4} more
                        </span>
                      )}
                    </div>
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
            <p className="text-sm text-destructive text-center">
              {error.message ?? "Something went wrong."}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t p-4">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-36 shrink-0 text-xs h-9">
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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your documents, meetings, or team…"
              rows={1}
              className="flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button type="button" size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* Right: context panel */}
      <aside className="w-72 shrink-0 border-l flex flex-col bg-card">
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
