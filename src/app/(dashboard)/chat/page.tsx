"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, Loader2, X, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data: Conversation[] = await res.json();
      setConversations(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  async function createConversation() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const conv: Conversation = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
    }
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);

  // Load conversation panel preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("chat-panel-visible");
    if (stored === "false") setPanelVisible(false);
    // Default hidden on mobile (handled by CSS), shown on desktop
  }, []);

  const togglePanel = () => {
    setPanelVisible((prev) => {
      const next = !prev;
      localStorage.setItem("chat-panel-visible", String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r flex flex-col bg-card transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          panelVisible ? "md:static md:translate-x-0" : "md:hidden"
        )}
      >
        <div className="p-3 border-b flex items-center gap-2">
          <Button
            onClick={createConversation}
            variant="outline"
            className="flex-1 justify-start gap-2 text-xs"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" />
            New conversation
          </Button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div role="status" aria-label="Loading conversations" className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <div className="flex flex-col items-center px-4 py-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs font-medium text-foreground">No conversations yet</p>
              <p className="text-[11px] mt-1">Start a new conversation to ask questions across your context.</p>
            </div>
          )}

          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-sm border-b border-border/50",
                activeId === conv.id && "bg-accent"
              )}
              onClick={() => { setActiveId(conv.id); setSidebarOpen(false); }}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-xs">
                {conv.title || "New conversation"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                aria-label={`Delete conversation: ${conv.title || "New conversation"}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="border-b px-4 sm:px-8 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:hidden"
              aria-label="Open conversations"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={togglePanel}
              className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label={panelVisible ? "Hide conversation list" : "Show conversation list"}
              title={panelVisible ? "Hide conversation list" : "Show conversation list"}
            >
              {panelVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <div>
              <h1 className="text-lg font-semibold">Chat with Granger</h1>
              <p className="text-xs text-muted-foreground">
                Ask questions across all your team&apos;s context.
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {activeId ? (
            <ChatInterface key={activeId} conversationId={activeId} initialTemplateId={templateParam} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground">
                Select or start a conversation
              </p>
              <p className="text-xs mt-1">
                Click &quot;New conversation&quot; to get started.
              </p>
              <Button
                onClick={createConversation}
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                New conversation
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
