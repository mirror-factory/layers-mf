"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Search, CheckCircle2, Bot, Sparkles, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolPart {
  type: string;
  state?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output?: any;
}

function SkillsToolCard({ part }: { part: ToolPart }) {
  const isDone = part.state === "output-available" || part.state === "output-error";
  const output = isDone && "output" in part ? part.output : undefined;

  // search_skills_marketplace: show searching indicator
  if (part.type === "tool-search_skills_marketplace") {
    if (!isDone) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1.5">
          <Search className="h-3.5 w-3.5 animate-pulse" />
          <span>Searching skills marketplace...</span>
        </div>
      );
    }
    return null; // Results shown in text response
  }

  // create_skill: show creation status
  if (part.type === "tool-create_skill") {
    if (!isDone) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Creating skill...</span>
        </div>
      );
    }
    const result = output as { status?: string; name?: string; slug?: string } | undefined;
    if (result?.status === "created" || result?.name) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs my-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>{result.name ?? "Skill"} created</span>
        </div>
      );
    }
    return null;
  }

  // activate_skill: show activation status
  if (part.type === "tool-activate_skill") {
    if (!isDone) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Activating skill...</span>
        </div>
      );
    }
    const result = output as { status?: string; name?: string } | undefined;
    if (result?.status === "activated" || result?.name) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs my-1">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>{result.name ?? "Skill"} activated</span>
        </div>
      );
    }
    return null;
  }

  // create_tool_from_code: show creation status
  if (part.type === "tool-create_tool_from_code") {
    if (!isDone) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1.5">
          <Code2 className="h-3.5 w-3.5 animate-pulse" />
          <span>Creating custom tool...</span>
        </div>
      );
    }
    const result = output as { status?: string; name?: string } | undefined;
    if (result?.name) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs my-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>Tool &quot;{result.name}&quot; created</span>
        </div>
      );
    }
    return null;
  }

  return null;
}

const SKILLS_SUCCESS_STATUSES = new Set(["created", "activated", "deleted"]);

export function SkillsChat() {
  const [input, setInput] = useState("");
  const router = useRouter();
  const lastRefreshedToolRef = useRef<string | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/skills",
    }),
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "streaming" || status === "submitted";

  // Refresh page data when a tool call completes with a success status
  const checkForSuccessfulToolOutputs = useCallback(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts ?? []) {
        if (!part.type.startsWith("tool-")) continue;
        const toolPart = part as ToolPart;
        if (toolPart.state !== "output-available") continue;
        const output = toolPart.output as { status?: string } | undefined;
        if (output?.status && SKILLS_SUCCESS_STATUSES.has(output.status)) {
          const key = `${message.id}-${part.type}-${output.status}`;
          if (lastRefreshedToolRef.current !== key) {
            lastRefreshedToolRef.current = key;
            setTimeout(() => router.refresh(), 500);
            return;
          }
        }
      }
    }
  }, [messages, router]);

  useEffect(() => {
    checkForSuccessfulToolOutputs();
  }, [checkForSuccessfulToolOutputs]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Skills Assistant</span>
        <span className="text-[10px] text-muted-foreground">Create and discover AI skills</span>
      </div>

      {/* Messages */}
      <div className="h-[320px] overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              Ask me to create or find AI skills.
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Try &quot;Create a writing skill&quot; or &quot;Search for code review&quot;
            </p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "text-sm",
              message.role === "user" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {message.role === "user" ? (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs">
                {message.parts
                  ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p, i) => (
                    <span key={i}>{p.text}</span>
                  ))}
              </div>
            ) : (
              <div className="space-y-1">
                {message.parts?.map((part, i) => {
                  if (part.type === "text" && "text" in part) {
                    return (
                      <div key={i} className="text-xs whitespace-pre-wrap leading-relaxed">
                        {(part as { type: "text"; text: string }).text}
                      </div>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    return <SkillsToolCard key={i} part={part as ToolPart} />;
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-3 py-2 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Create a skill, search marketplace..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-xs placeholder:text-muted-foreground/50 focus:outline-none py-1.5"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="shrink-0 rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
