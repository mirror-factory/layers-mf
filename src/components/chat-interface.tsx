"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, Loader2, Bot, User,
  FileText, Mic, GitBranch, MessageSquare, HardDrive, Upload, Hash, Github,
  LayoutGrid, ThumbsUp, ThumbsDown,
  MoreHorizontal, Copy, Download, FileJson, Share2, Check, X,
} from "lucide-react";
import { CodeSandbox } from "@/components/code-sandbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
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
  // Flagship
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", tier: "flagship" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", tier: "flagship" },
  { id: "google/gemini-3-pro", label: "Gemini 3 Pro", tier: "flagship" },
  // Balanced
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", tier: "balanced" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini", tier: "balanced" },
  { id: "google/gemini-3-flash", label: "Gemini 3 Flash", tier: "balanced" },
  // Fast
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", tier: "fast" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", tier: "fast" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini Flash Lite", tier: "fast" },
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

function InlineApproval({ approvalId, reasoning, actionType, targetService, conflictReason }: {
  approvalId: string;
  reasoning?: string;
  actionType?: string;
  targetService?: string;
  conflictReason?: string;
}) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "executing">("pending");
  const [result, setResult] = useState<string | null>(null);

  const handleAction = useCallback(async (action: "approve" | "reject") => {
    setStatus(action === "approve" ? "executing" : "rejected");
    try {
      const res = await fetch(`/api/approval/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (action === "approve") {
        setStatus("approved");
        if (data.execution?.success) {
          const exec = data.execution;
          if (exec.issue) {
            setResult(`✓ Created ${exec.issue.identifier}: "${exec.issue.title ?? ""}" — ${exec.issue.url}`);
          } else if (exec.draft) {
            setResult(`✓ Draft saved — open_gmail`);
          } else {
            setResult(`✓ Executed successfully: ${JSON.stringify(exec, null, 2)}`);
          }
        } else if (data.execution?.error) {
          setResult(`✗ Execution failed: ${data.execution.error}`);
        } else if (data.execution?.reason) {
          setResult(`Approved (not auto-executed: ${data.execution.reason})`);
        } else {
          setResult("Approved");
        }
      } else {
        setResult("Rejected");
      }
    } catch {
      setResult("Error processing action");
      setStatus("pending");
    }
  }, [approvalId]);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          Approval Required
        </span>
        {actionType && <span className="text-xs text-muted-foreground">{actionType}</span>}
        {targetService && <span className="text-xs text-muted-foreground">→ {targetService}</span>}
      </div>
      {reasoning && <p className="text-sm text-foreground">{reasoning}</p>}
      {conflictReason && (
        <div className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
          Priority doc conflict: {conflictReason}
        </div>
      )}
      {status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleAction("approve")}>
            Approve & Execute
          </Button>
          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950" onClick={() => handleAction("reject")}>
            Reject
          </Button>
        </div>
      )}
      {status === "executing" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Executing...
        </div>
      )}
      {result && (
        <div className={cn("text-xs p-2 rounded", status === "approved" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : status === "rejected" ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-muted text-muted-foreground")}>
          {result.includes("open_gmail") ? (
            <span>
              {result.replace("open_gmail", "")}{" "}
              <a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:opacity-80">
                Open in Gmail →
              </a>
            </span>
          ) : result.includes("https://") ? (
            <>
              {result.split(/(https:\/\/\S+)/g).map((part, i) =>
                part.startsWith("https://") ? (
                  <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:opacity-80">
                    {part}
                  </a>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </>
          ) : result}
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ part }: { part: ToolPart }) {
  const isDone = part.state === "output-available" || part.state === "output-error";
  const output = isDone && "output" in part ? part.output : undefined;
  const errorText = "errorText" in part ? part.errorText : undefined;
  const isDynamic = part.type === "dynamic-tool";

  // Check if this is an approval proposal
  const isApproval = isDone && output && typeof output === "object" && "approval_id" in (output as Record<string, unknown>);
  const approvalOutput = isApproval ? output as Record<string, unknown> : null;

  // Check if this is a sandbox execution result (has exitCode + stdout)
  const isSandboxResult = isDone && output && typeof output === "object"
    && "exitCode" in (output as Record<string, unknown>)
    && "stdout" in (output as Record<string, unknown>);

  if (isSandboxResult) {
    const sbox = output as Record<string, unknown>;
    const sFilename = String(sbox.filename ?? "script");
    const sLanguage = String(sbox.language ?? "javascript");
    const sCode = typeof sbox.code === "string" ? sbox.code : "";
    const sStdout = typeof sbox.stdout === "string" ? sbox.stdout : "";
    const sStderr = typeof sbox.stderr === "string" ? sbox.stderr : "";
    const sExitCode = typeof sbox.exitCode === "number" ? sbox.exitCode : 1;
    const sPreviewUrl = typeof sbox.previewUrl === "string" ? sbox.previewUrl : null;
    const hasOutput = sStdout.trim().length > 0 || sStderr.trim().length > 0;

    // If we have a previewUrl AND code, render the CodeSandbox split view only
    // (it already shows code + preview side-by-side — no need for duplicate terminal/iframe)
    if (sPreviewUrl && sCode) {
      return (
        <CodeSandbox
          filename={sFilename}
          language={sLanguage}
          code={sCode}
          description={sExitCode === 0 ? undefined : `Exit code: ${sExitCode}`}
        />
      );
    }

    // No previewUrl — show collapsible code + terminal output
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Collapsible code — show filename header, expand to see code */}
        {sCode && (
          <details className="group">
            <summary className="flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-muted">
              <span className="text-muted-foreground">▶</span>
              <span className="font-mono">{sFilename}</span>
              <span className="text-muted-foreground">({sLanguage})</span>
              <span className={cn("ml-auto", sExitCode === 0 ? "text-green-600" : "text-red-600")}>
                {sExitCode === 0 ? "✓ Success" : `✗ Exit ${sExitCode}`}
              </span>
            </summary>
            <div className="border-t">
              <CodeSandbox filename={sFilename} language={sLanguage} code={sCode} />
            </div>
          </details>
        )}
        {/* Terminal output — only show if there's actual output */}
        {hasOutput && (
        <div className={cn("bg-zinc-950 text-green-400 p-3 font-mono text-xs max-h-48 overflow-y-auto", sCode ? "border-t" : "")}>
          {sStdout && (
            <pre className="whitespace-pre-wrap">{sStdout}</pre>
          )}
          {sStderr && (
            <pre className="whitespace-pre-wrap text-red-400">{sStderr}</pre>
          )}
        </div>
        )}
      </div>
    );
  }

  // Check if this is a code artifact from write_code
  const isCodeArtifact = isDone && output && typeof output === "object" && "code" in (output as Record<string, unknown>) && "language" in (output as Record<string, unknown>);
  const codeOutput = isCodeArtifact ? output as Record<string, unknown> : null;

  // Render code artifact as CodeSandbox instead of raw JSON
  if (codeOutput) {
    return (
      <CodeSandbox
        filename={codeOutput.filename as string}
        language={codeOutput.language as string}
        code={codeOutput.code as string}
        description={codeOutput.message as string | undefined}
        contextId={codeOutput.context_id as string | undefined}
      />
    );
  }

  return (
    <>
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
          {isDone && !isApproval && (
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
      {isApproval && approvalOutput && (
        <InlineApproval
          approvalId={approvalOutput.approval_id as string}
          reasoning={approvalOutput.message as string | undefined}
          actionType={"input" in part ? (part.input as Record<string, unknown>)?.action_type as string : undefined}
          targetService={"input" in part ? (part.input as Record<string, unknown>)?.target_service as string : undefined}
          conflictReason={approvalOutput.conflict as string | undefined}
        />
      )}
    </>
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

// --- Export & Share helpers ---

function formatMessagesAsMarkdown(
  messages: UIMessage[],
  conversationId?: string | null,
): string {
  const title = conversationId ? `Conversation ${conversationId}` : "Conversation";
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = [`# ${title}`, `Date: ${date}`, ""];

  for (const m of messages) {
    const parts = m.parts as { type: string; text?: string }[];
    const text = getTextContent(parts);
    const toolParts = getToolParts(parts);

    const roleName = m.role === "user" ? "User" : "Granger";
    lines.push(`## ${roleName}`);

    if (text) {
      lines.push("", text, "");
    }

    for (const tp of toolParts) {
      const toolName = tp.type.replace("tool-", "");
      lines.push(`### Tool: ${toolName}`);
      if ("input" in tp && tp.input) {
        lines.push("", "**Input:**", "```json", JSON.stringify(tp.input, null, 2), "```", "");
      }
      if (tp.state === "output-available" && "output" in tp && tp.output) {
        const out = typeof tp.output === "string" ? tp.output : JSON.stringify(tp.output, null, 2);
        lines.push("**Output:**", "```json", out, "```", "");
      }
    }

    lines.push("---", "");
  }

  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type TeamMember = { userId: string; email: string; role: string };

function SharePanel({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [sharedWith, setSharedWith] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [membersRes, sharedRes] = await Promise.all([
          fetch("/api/team/members"),
          fetch(`/api/chat/share?conversation_id=${conversationId}`),
        ]);
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data);
        }
        if (sharedRes.ok) {
          const data = await sharedRes.json();
          setSharedWith(new Set(data.sharedWith ?? []));
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [conversationId]);

  const toggleMember = (userId: string) => {
    setSharedWith((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
    setSaved(false);
  };

  const handleShare = async () => {
    if (sharedWith.size === 0) return;
    setSaving(true);
    try {
      await fetch("/api/chat/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          userIds: Array.from(sharedWith),
        }),
      });
      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-card shadow-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Share conversation</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No team members found.</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => toggleMember(m.userId)}
              className={cn(
                "flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs transition-colors",
                sharedWith.has(m.userId)
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-accent text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                  sharedWith.has(m.userId) ? "bg-primary border-primary" : "border-muted-foreground/30"
                )}
              >
                {sharedWith.has(m.userId) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </div>
              <span className="truncate">{m.email}</span>
            </button>
          ))}
        </div>
      )}
      <Button
        size="sm"
        className="w-full text-xs h-7"
        disabled={sharedWith.size === 0 || saving}
        onClick={handleShare}
      >
        {saved ? (
          <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Shared</span>
        ) : saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          `Share with ${sharedWith.size} member${sharedWith.size !== 1 ? "s" : ""}`
        )}
      </Button>
    </div>
  );
}

interface ChatInterfaceProps {
  conversationId?: string | null;
  initialTemplateId?: string | null;
}

export function ChatInterface({ conversationId, initialTemplateId }: ChatInterfaceProps) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>(undefined);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    setInitialMessages(undefined);
    setHistoryLoaded(false);

    const params = new URLSearchParams();
    if (conversationId) params.set("conversation_id", conversationId);
    const url = `/api/chat/history${params.toString() ? `?${params}` : ""}`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((msgs: UIMessage[]) => {
        setInitialMessages(msgs.length > 0 ? msgs : []);
        setHistoryLoaded(true);
      })
      .catch(() => {
        setInitialMessages([]);
        setHistoryLoaded(true);
      });
  }, [conversationId]);

  if (!historyLoaded) {
    return (
      <div className="flex h-full overflow-hidden flex-col md:flex-row">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto p-6">
            <div role="status" aria-label="Loading conversation" className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2 opacity-40" />
              <p className="text-xs">Loading conversation...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatInterfaceInner
      conversationId={conversationId}
      initialTemplateId={initialTemplateId}
      initialMessages={initialMessages}
    />
  );
}

interface ChatInterfaceInnerProps {
  conversationId?: string | null;
  initialTemplateId?: string | null;
  initialMessages?: UIMessage[];
}

function ChatInterfaceInner({ conversationId, initialTemplateId, initialMessages }: ChatInterfaceInnerProps) {
  const [model, setModel] = useState<string>("anthropic/claude-sonnet-4.6");
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeTemplate, setActiveTemplate] = useState<AgentTemplate | null>(
    initialTemplateId ? AGENT_TEMPLATES.find((t) => t.id === initialTemplateId) ?? null : null,
  );

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages && initialMessages.length > 0 ? initialMessages : undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { model, conversationId },
    }),
    onFinish: () => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const [shareOpen, setShareOpen] = useState(false);

  const getDebugJSON = useCallback(() => ({
    conversationId,
    model,
    status,
    messageCount: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
    })),
  }), [messages, conversationId, model, status]);

  const copyDebugJSON = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(getDebugJSON(), null, 2));
  }, [getDebugJSON]);

  const exportMarkdown = useCallback(() => {
    const md = formatMessagesAsMarkdown(messages, conversationId);
    const filename = conversationId
      ? `conversation-${conversationId.slice(0, 8)}.md`
      : `conversation-${Date.now()}.md`;
    downloadFile(md, filename, "text/markdown");
  }, [messages, conversationId]);

  const exportJSON = useCallback(() => {
    const json = JSON.stringify(getDebugJSON(), null, 2);
    const filename = conversationId
      ? `conversation-${conversationId.slice(0, 8)}.json`
      : `conversation-${Date.now()}.json`;
    downloadFile(json, filename, "application/json");
  }, [getDebugJSON, conversationId]);

  // Slash command definitions with metadata for the autocomplete menu
  const SLASH_MENU_ITEMS = [
    { cmd: "/linear", label: "Linear", description: "Query issues, create tasks", icon: "⚡" },
    { cmd: "/tasks", label: "Tasks", description: "Show in-progress tasks", icon: "📋" },
    { cmd: "/gmail", label: "Gmail", description: "Search and draft emails", icon: "✉️" },
    { cmd: "/notion", label: "Notion", description: "Search pages and databases", icon: "📝" },
    { cmd: "/granola", label: "Granola", description: "Meeting transcripts", icon: "🎙️" },
    { cmd: "/drive", label: "Drive", description: "Search Google Drive files", icon: "📁" },
    { cmd: "/schedule", label: "Schedule", description: "View scheduled actions", icon: "⏰" },
    { cmd: "/approve", label: "Approve", description: "Pending approvals", icon: "✅" },
    { cmd: "/status", label: "Status", description: "Full status summary", icon: "📊" },
    { cmd: "/run", label: "Run Code", description: "Execute code in sandbox", icon: "▶️" },
    { cmd: "/help", label: "Help", description: "List all commands", icon: "❓" },
  ];

  // Slash command mappings — expand to explicit tool instructions for the AI
  const SLASH_COMMANDS: Record<string, (args: string) => string> = {
    "/linear": (args) => args ? `Use the ask_linear_agent tool to find issues matching: ${args}` : "Use the ask_linear_agent tool to show all my current issues",
    "/tasks": (args) => args ? `Use the ask_linear_agent tool to find: ${args}` : "Use the ask_linear_agent tool to show my in-progress tasks",
    "/gmail": (args) => args ? `Use the ask_gmail_agent tool to search emails: ${args}` : "Use the ask_gmail_agent tool to show my recent emails from the last 3 days",
    "/email": (args) => args ? `Use the ask_gmail_agent tool to search: ${args}` : "Use the ask_gmail_agent tool to show my recent emails",
    "/notion": (args) => args ? `Use the ask_notion_agent tool to find: ${args}` : "Use the ask_notion_agent tool to list my pages",
    "/granola": (args) => args ? `Use the ask_granola_agent tool to find meetings about: ${args}` : "Use the ask_granola_agent tool to show recent meetings",
    "/drive": (args) => args ? `Use the ask_drive_agent tool to search for: ${args}` : "Use the ask_drive_agent tool to show my recent files",
    "/approve": () => "Use the list_approvals tool to show all pending items in the approval queue",
    "/status": () => "Give me a full status update: check pending approvals, overdue tasks, and recent context items",
    "/schedule": () => "Show me all scheduled actions and their status",
    "/run": (args) => args ? `Use run_code to execute: ${args}` : "Use run_code to execute code in a sandbox. Ask me what to run.",
    "/help": () => "List all available slash commands: /linear, /tasks, /gmail, /notion, /granola, /drive, /approve, /status, /schedule, /run",
  };

  // Filter menu items based on what the user has typed
  const slashMenuVisible = input.startsWith("/") && !input.includes(" ");
  const slashMenuFiltered = slashMenuVisible
    ? SLASH_MENU_ITEMS.filter(item => item.cmd.startsWith(input.toLowerCase()))
    : [];
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);

  // Reset menu index when filter changes
  useEffect(() => { setSlashMenuIndex(0); }, [input]);

  const selectSlashCommand = useCallback((cmd: string) => {
    setInput(cmd + " ");
  }, []);

  function handleSend() {
    let text = input.trim();
    if (!text || isLoading) return;

    // Parse slash commands — transform /command into AI-directed prompts
    const slashMatch = text.match(/^(\/\w+)\s*(.*)?$/);
    if (slashMatch) {
      const [, cmd, args] = slashMatch;
      const handler = SLASH_COMMANDS[cmd.toLowerCase()];
      if (handler) {
        const expanded = handler(args?.trim() ?? "");
        console.log(`[Granger] Slash command ${cmd} → "${expanded}"`);
        text = expanded;
      }
    }

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
        {messages.length > 0 && (
          <div className="flex justify-end px-4 py-1 border-b relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-1"
                  aria-label="Chat actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Actions</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={copyDebugJSON}>
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Copy JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportMarkdown}>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Export Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJSON}>
                  <FileJson className="h-3.5 w-3.5 mr-2" />
                  Export JSON file
                </DropdownMenuItem>
                {conversationId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShareOpen(true)}>
                      <Share2 className="h-3.5 w-3.5 mr-2" />
                      Share...
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {shareOpen && conversationId && (
              <SharePanel
                conversationId={conversationId}
                onClose={() => setShareOpen(false)}
              />
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground">Ask anything about your team&apos;s knowledge</p>
              <p className="text-xs mt-1">Granger searches your documents, meetings, and notes to answer.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
                {[
                  "Show my in-progress Linear issues",
                  "What are our Q2 priorities?",
                  "What decisions were made about the roadmap?",
                  "Summarize last week\u2019s meetings",
                  "Search my recent emails",
                  "What Notion pages do we have?",
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
              <div key={m.id} className={cn("flex gap-3 group", m.role === "user" ? "max-w-3xl ml-auto flex-row-reverse" : "max-w-4xl")}>
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <Message from={m.role} className="min-w-0 flex-1">
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
                    <MessageContent>
                      {m.role === "user" ? (
                        text
                      ) : (
                        <MessageResponse>{text}</MessageResponse>
                      )}
                    </MessageContent>
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
                </Message>
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
            {/* Slash command autocomplete menu */}
            {slashMenuFiltered.length > 0 && (
              <div className="max-w-3xl mx-auto mb-1">
                <div className="border rounded-lg bg-background shadow-lg overflow-hidden">
                  {slashMenuFiltered.map((item, i) => (
                    <button
                      key={item.cmd}
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        i === slashMenuIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      )}
                      onMouseEnter={() => setSlashMenuIndex(i)}
                      onClick={() => selectSlashCommand(item.cmd)}
                    >
                      <span className="text-base w-6 text-center">{item.icon}</span>
                      <span className="font-mono text-xs font-medium text-primary">{item.cmd}</span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 flex-1">
              <textarea
                data-testid="chat-input"
                aria-label="Chat message input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your documents, meetings, or team… (type / for commands)"
                rows={1}
                className="flex-1 resize-none rounded-lg border bg-background px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  // Slash menu navigation
                  if (slashMenuFiltered.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSlashMenuIndex(i => (i + 1) % slashMenuFiltered.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSlashMenuIndex(i => (i - 1 + slashMenuFiltered.length) % slashMenuFiltered.length);
                      return;
                    }
                    if (e.key === "Tab" || (e.key === "Enter" && !input.includes(" "))) {
                      e.preventDefault();
                      selectSlashCommand(slashMenuFiltered[slashMenuIndex].cmd);
                      return;
                    }
                    if (e.key === "Escape") {
                      setInput("");
                      return;
                    }
                  }
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
