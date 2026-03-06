"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getTextContent(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

export function ChatInterface() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Ask anything about your team&apos;s knowledge</p>
            <p className="text-xs mt-1">Layers searches your documents, meetings, and notes to answer.</p>
          </div>
        )}

        {messages.map((m) => {
          const text = getTextContent(m.parts as { type: string; text?: string }[]);
          if (!text && m.role !== "user") return null;
          return (
            <div
              key={m.id}
              className={cn(
                "flex gap-3 max-w-3xl",
                m.role === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
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
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
            <div className="rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">
            {error.message ?? "Something went wrong. Is ANTHROPIC_API_KEY set?"}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-3 max-w-3xl mx-auto">
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
        <p className="text-xs text-muted-foreground text-center mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
