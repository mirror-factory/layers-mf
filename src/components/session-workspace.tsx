"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, Loader2, Bot, User, FileText, X, Users, UserPlus,
  Mic, GitBranch, MessageSquare, HardDrive, Upload, Hash, Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { AddContextPicker } from "@/components/add-context-picker";

type ContextItem = {
  id: string;
  title: string;
  source_type: string;
  content_type: string;
  description_short: string | null;
};

type Session = {
  id: string;
  name: string;
  goal: string;
  status: string;
  updated_at: string;
};

type SessionMember = {
  id: string;
  user_id: string;
  role: string;
  email?: string | null;
};

type OrgMember = {
  id: string;
  userId: string;
  email: string;
  role: string;
};

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

const SOURCE_ICON: Record<string, React.ElementType> = {
  "google-drive": HardDrive,
  gdrive: HardDrive,
  github: Github,
  "github-app": Github,
  slack: Hash,
  upload: Upload,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  archived: "outline",
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

function ToolCallCard({ part }: { part: ToolPart }) {
  const isDone = part.state === "output-available" || part.state === "output-error";
  const output = isDone && "output" in part ? part.output : undefined;
  const errorText = "errorText" in part ? part.errorText : undefined;
  const isDynamic = part.type === "dynamic-tool";

  return (
    <Tool defaultOpen={isDone}>
      {isDynamic ? (
        <ToolHeader type="dynamic-tool" state={part.state} toolName={"toolName" in part ? (part.toolName as string) : ""} />
      ) : (
        <ToolHeader type={part.type as `tool-${string}`} state={part.state} />
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

export function SessionWorkspace({
  session,
  linkedItems: initialLinked,
  availableItems: initialAvailable,
}: {
  session: Session;
  linkedItems: ContextItem[];
  availableItems: ContextItem[];
}) {
  const [model, setModel] = useState<string>("anthropic/claude-haiku-4-5-20251001");
  const [input, setInput] = useState("");
  const [linked, setLinked] = useState<ContextItem[]>(initialLinked);
  const [available, setAvailable] = useState<ContextItem[]>(initialAvailable);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load session members
  useEffect(() => {
    fetch(`/api/sessions/${session.id}/members`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setMembers)
      .catch(() => {});
  }, [session.id]);

  // Load org members when share dialog opens
  const loadOrgMembers = useCallback(() => {
    if (orgMembers.length > 0) return;
    fetch("/api/team/members")
      .then((res) => (res.ok ? res.json() : []))
      .then(setOrgMembers)
      .catch(() => {});
  }, [orgMembers.length]);

  async function handleAddMember(userId: string) {
    setAddingMember(true);
    const res = await fetch(`/api/sessions/${session.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) {
      const newMember = await res.json();
      const orgMember = orgMembers.find((m) => m.userId === userId);
      setMembers((prev) => [...prev, { ...newMember, email: orgMember?.email }]);
      toast.success("Member added to session");
    } else if (res.status === 409) {
      toast.error("User is already a member");
    } else {
      toast.error("Failed to add member");
    }
    setAddingMember(false);
  }

  useEffect(() => {
    fetch(`/api/chat/history?session_id=${session.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((msgs: UIMessage[]) => {
        if (msgs.length > 0) setInitialMessages(msgs);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [session.id]);

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/chat/session/${session.id}`,
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

  async function handleLink(item: ContextItem) {
    const res = await fetch(`/api/sessions/${session.id}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context_item_id: item.id }),
    });
    if (res.ok) {
      setLinked((prev) => [...prev, item]);
      setAvailable((prev) => prev.filter((a) => a.id !== item.id));
      toast.success("Context added");
    }
  }

  async function handleUnlink(itemId: string) {
    const res = await fetch(`/api/sessions/${session.id}/context`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context_item_id: itemId }),
    });
    if (res.ok || res.status === 204) {
      const removed = linked.find((l) => l.id === itemId);
      setLinked((prev) => prev.filter((l) => l.id !== itemId));
      if (removed) setAvailable((prev) => [removed, ...prev]);
      toast.success("Context removed");
    }
  }

  return (
    <div data-testid="session-workspace" className="flex h-full overflow-hidden">
      {/* Left: context panel */}
      <aside className="w-64 shrink-0 border-r flex flex-col bg-card">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold truncate">{session.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{session.goal}</p>
          <div className="flex items-center justify-between mt-1.5">
            <Badge variant={STATUS_VARIANT[session.status] ?? "outline"} className="text-[10px]">
              {session.status}
            </Badge>
            <div className="flex items-center gap-1">
              {/* Member avatars */}
              {members.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-medium"
                  title={m.email ?? m.user_id}
                >
                  {(m.email ?? m.user_id).charAt(0).toUpperCase()}
                </div>
              ))}
              {members.length > 3 && (
                <span className="text-[9px] text-muted-foreground">+{members.length - 3}</span>
              )}
              {/* Share button */}
              <Dialog open={shareOpen} onOpenChange={(open) => { setShareOpen(open); if (open) loadOrgMembers(); }}>
                <DialogTrigger asChild>
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    title="Share session"
                  >
                    <UserPlus className="h-2.5 w-2.5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Share Session
                    </DialogTitle>
                    <DialogDescription>
                      Invite org members to collaborate on this session.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {orgMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Loading members…</p>
                    ) : (
                      orgMembers
                        .filter((om) => !members.some((m) => m.user_id === om.userId))
                        .map((om) => (
                          <div
                            key={om.id}
                            className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                                {om.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm truncate">{om.email}</p>
                                <p className="text-xs text-muted-foreground">{om.role}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddMember(om.userId)}
                              disabled={addingMember}
                              className="text-xs h-7 shrink-0"
                            >
                              Add
                            </Button>
                          </div>
                        ))
                    )}
                    {orgMembers.length > 0 &&
                      orgMembers.filter((om) => !members.some((m) => m.user_id === om.userId)).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          All org members have been added.
                        </p>
                      )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-b flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Context ({linked.length})
          </p>
          <AddContextPicker items={available} onAdd={handleLink} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {linked.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 text-center">
              <FileText className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs">Add context items to scope the AI search.</p>
            </div>
          ) : (
            <div className="divide-y">
              {linked.map((item) => {
                const Icon = CONTENT_ICON[item.content_type] ?? FileText;
                const SrcIcon = SOURCE_ICON[item.source_type] ?? FileText;
                return (
                  <div key={item.id} className="px-3 py-2 group">
                    <div className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug line-clamp-2">{item.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <SrcIcon className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {item.source_type}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnlink(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Center: chat */}
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
              <p className="text-sm font-medium">Session: {session.name}</p>
              <p className="text-xs mt-1">Ask questions scoped to the linked documents.</p>
            </div>
          )}

          {messages.map((m) => {
            const parts = m.parts as { type: string; text?: string }[];
            const text = getTextContent(parts);
            const toolParts = m.role === "assistant" ? getToolParts(parts) : [];

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
                  {toolParts.length > 0 && (
                    <div className="space-y-2">
                      {toolParts.map((part, i) => (
                        <ToolCallCard key={i} part={part} />
                      ))}
                    </div>
                  )}

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
              placeholder="Ask about your session documents…"
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
    </div>
  );
}
