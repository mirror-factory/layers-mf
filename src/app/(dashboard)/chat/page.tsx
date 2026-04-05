"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateParam = searchParams.get("template");
  const promptParam = searchParams.get("prompt");
  const idParam = searchParams.get("id");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdRaw] = useState<string | null>(idParam);

  // Update URL when conversation changes
  const setActiveId = useCallback((id: string | null) => {
    setActiveIdRaw(id);
    if (id) {
      router.replace(`/chat?id=${id}`, { scroll: false });
    } else {
      router.replace("/chat", { scroll: false });
    }
  }, [router]);
  const [loading, setLoading] = useState(true);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(promptParam);

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

  const createConversation = useCallback(async () => {
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
  }, [setActiveId]);

  // When no conversation is selected and no URL param, auto-create one
  // This ensures every chat has a conversationId for message persistence
  const showNewChat = !activeId && !idParam;
  const autoCreatedRef = useRef(false);

  useEffect(() => {
    if (showNewChat && !loading && !autoCreatedRef.current && !initialPrompt) {
      autoCreatedRef.current = true;
      createConversation();
    }
  }, [showNewChat, loading, initialPrompt, createConversation]);

  // Auto-create a conversation and set the initial prompt when ?prompt= is present
  useEffect(() => {
    if (!initialPrompt || loading) return;

    async function autoCreateAndSend() {
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
      // Clear the URL param so it doesn't re-trigger
      window.history.replaceState({}, "", "/chat");
    }

    autoCreateAndSend();
  }, [initialPrompt, loading]);

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
    <div className="flex h-full">
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
        <div className="p-2 border-b flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search chats…"
            className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
          />
          <button
            onClick={() => { setSidebarOpen(false); setPanelVisible(false); }}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
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

          {conversations.filter((conv) => !searchQuery || (conv.title ?? "").toLowerCase().includes(searchQuery)).map((conv) => {
            const displayTitle = conv.title || "New conversation";
            return (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-sm border-b border-border/50 transition-colors",
                  activeId === conv.id && "bg-accent border-l-2 border-l-primary"
                )}
                onClick={() => { setActiveId(conv.id); setSidebarOpen(false); }}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-xs">
                    {displayTitle}
                  </span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {relativeTime(conv.updated_at)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  aria-label={`Delete conversation: ${displayTitle}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500 transition-colors" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="border-b px-3 py-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {/* Sidebar toggle — always visible */}
            <button
              onClick={() => {
                // Mobile: toggle sidebar overlay. Desktop: toggle panel
                if (window.innerWidth < 768) setSidebarOpen(true);
                else togglePanel();
              }}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
              aria-label={panelVisible ? "Hide conversations" : "Show conversations"}
              title={panelVisible ? "Hide conversations" : "Show conversations"}
            >
              {panelVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            {/* New chat — always visible, accent color */}
            <button
              onClick={createConversation}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Chat with Granger
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {activeId ? (
            <ChatInterface key={activeId} conversationId={activeId} initialTemplateId={templateParam} initialPrompt={initialPrompt} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mb-2" />
              <p className="text-xs">Loading...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
