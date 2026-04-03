"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Loader2, User, Square,
  FileText, Mic, GitBranch, MessageSquare, MessageSquareText, HardDrive, Upload, Hash, Github,
  LayoutGrid, ThumbsUp, ThumbsDown,
  MoreHorizontal, Copy, Download, FileJson, Share2, Check, X,
  PanelRightClose, PanelRightOpen, FileCode2, ExternalLink, Globe,
  Paperclip, Image as ImageIcon, FileType, Zap, BarChart3, Clock, Settings2,
} from "lucide-react";
import { NeuralDots } from "@/components/ui/neural-dots";
import { InterviewUI } from "@/components/interview-ui";
import { CodeSandbox } from "@/components/code-sandbox";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { TiptapEditor } from "@/components/tiptap-editor";
import { FileTree, buildFileTree, findFileNode } from "@/components/file-tree";
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
import { ContextWindowBar } from "@/components/chat/context-window-bar";
import { ArtifactVersionHistory } from "@/components/artifact-version-history";
import { Entropy } from "@/components/ui/entropy";
import { NeuralMorph } from "@/components/ui/neural-morph";
import { getActiveFormation, getDoneFormation, getOldFormation, parseEmotion } from "@/lib/avatar-state";

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
  { id: "google/gemini-3.1-flash-lite-preview", label: "Gemini Flash Lite", tier: "fast" },
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/markdown", "text/csv",
];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.md,.csv";

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileType;
  return FileText;
}

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

function InlineApproval({ approvalId, reasoning, actionType, targetService, conflictReason, onExecuted }: {
  approvalId: string;
  reasoning?: string;
  actionType?: string;
  targetService?: string;
  conflictReason?: string;
  onExecuted?: (result: string) => void;
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
        let resultMsg = "Approved";
        if (data.execution?.success) {
          const exec = data.execution;
          if (exec.issue) {
            resultMsg = `Approved and executed: Created Linear issue ${exec.issue.identifier} — ${exec.issue.url}`;
          } else if (exec.draft) {
            resultMsg = `Approved and executed: Email draft saved to Gmail`;
          } else {
            resultMsg = `Approved and executed successfully`;
          }
        } else if (data.execution?.error) {
          resultMsg = `Approved but execution failed: ${data.execution.error}`;
        } else if (data.execution?.reason) {
          resultMsg = `Approved (not auto-executed: ${data.execution.reason})`;
        }
        setResult(resultMsg);
        // Notify the conversation so Granger knows what happened
        onExecuted?.(resultMsg);
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

interface ActiveArtifact {
  filename: string;
  language: string;
  code: string;
  description?: string;
  contextId?: string;
  previewUrl?: string;
  /** Multi-file support for run_project results */
  files?: { path: string; content: string }[];
  /** "document" artifacts render in TipTap editor instead of code viewer */
  type?: "code" | "document";
  /** Sandbox snapshot ID for restart capability */
  snapshotId?: string;
  /** Run command used to start the sandbox */
  runCommand?: string;
  /** Port that was exposed for preview */
  exposePort?: number;
  /** Artifact system ID */
  artifactId?: string;
  /** Current version number */
  currentVersion?: number;
}

/** Extract URLs from text (markdown links, bare URLs, and footnote references) */
function extractUrls(text: string): { url: string; title: string }[] {
  const seen = new Set<string>();
  const results: { url: string; title: string }[] = [];

  // Match markdown links: [title](url)
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(text)) !== null) {
    if (!seen.has(match[2])) {
      seen.add(match[2]);
      results.push({ url: match[2], title: match[1] });
    }
  }

  // Match bare URLs not already captured (negative lookbehind excludes markdown link URLs)
  const bareRegex = /(?<!\()https?:\/\/[^\s)\]>]+/g;
  while ((match = bareRegex.exec(text)) !== null) {
    if (!seen.has(match[0])) {
      seen.add(match[0]);
      results.push({ url: match[0], title: getHostname(match[0]) });
    }
  }

  return results;
}

/** Get a display hostname from a URL */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Inline TipTap editor for document artifacts in the artifact panel */
function DocumentArtifactEditor({ content, documentId }: { content: string; documentId?: string }) {
  const [editorContent, setEditorContent] = useState(content);

  // Sync when content changes externally (e.g. new artifact selected)
  useEffect(() => {
    setEditorContent(content);
  }, [content]);

  return (
    <TiptapEditor
      content={editorContent}
      onChange={setEditorContent}
      editable={true}
      documentId={documentId}
      placeholder="Document content..."
      className="min-h-full"
    />
  );
}

/**
 * Rich message response that detects inline visual blocks in text:
 * - ```html ... ``` → renders as real HTML/SVG inline (diagrams, charts, animations)
 * - ```jsonui ... ``` → renders as json-render components
 * Works with ANY model. HTML blocks render progressively as they stream in.
 */
function RichMessageResponse({ text }: { text: string }) {
  // Match ```html and ```svg blocks
  const blockRegex = /```(?:html|svg)\s*\n([\s\S]*?)(?:\n```|$)/g;
  const parts: { type: "text" | "html"; content: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "html", content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  // No html blocks — render normally
  if (parts.length <= 1 && parts[0]?.type === "text") {
    return <MessageResponse>{text}</MessageResponse>;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text" && part.content.trim()) {
          return <MessageResponse key={i}>{part.content}</MessageResponse>;
        }
        if (part.type === "html") {
          return <InlineHtmlBlock key={i} html={part.content} />;
        }
        return null;
      })}
    </>
  );
}

/** CDN libraries for inline HTML rendering */
const INLINE_LIBS = [
  "https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js",
  "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/roughjs@4/bundled/rough.js",
  "https://cdn.jsdelivr.net/npm/zdog@1/dist/zdog.dist.min.js",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1/dist/confetti.browser.js",
];

/**
 * Inline HTML block — renders directly in DOM with dangerouslySetInnerHTML.
 * Scripts execute via dynamic script elements for Chart.js/GSAP support.
 * No iframe = no height issues.
 */
function InlineHtmlBlock({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const libsLoaded = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Load CDN libs once (appended to document head)
    if (!libsLoaded.current) {
      libsLoaded.current = true;
      for (const url of INLINE_LIBS) {
        if (!document.querySelector(`script[src="${url}"]`)) {
          const s = document.createElement("script");
          s.src = url;
          s.async = true;
          document.head.appendChild(s);
        }
      }
    }

    // Strip gradients from inline styles
    const cleaned = html
      .replace(/background\s*:\s*(?:linear-gradient|radial-gradient)\([^)]+\)\s*;?/gi, "")
      .replace(/background-image\s*:\s*(?:linear-gradient|radial-gradient)\([^)]+\)\s*;?/gi, "");

    // Separate scripts from HTML
    const scriptRegex = /<script[\s\S]*?>([\s\S]*?)<\/script>/gi;
    const scripts: string[] = [];
    let match;
    while ((match = scriptRegex.exec(cleaned)) !== null) {
      if (match[1].trim()) scripts.push(match[1]);
    }
    const htmlOnly = cleaned.replace(scriptRegex, "");

    // Set HTML
    container.innerHTML = htmlOnly;

    // Execute scripts after a delay (let CDN libs load)
    const timer = setTimeout(() => {
      for (const code of scripts) {
        try {
          // Set Chart.js dark defaults before each script
          if (typeof (window as unknown as Record<string, unknown>).Chart !== "undefined") {
            const C = (window as unknown as Record<string, { defaults: Record<string, unknown> }>).Chart;
            C.defaults.color = "#9ca3af";
            C.defaults.borderColor = "rgba(255,255,255,0.06)";
            C.defaults.responsive = true;
            C.defaults.maintainAspectRatio = false;
          }
          const fn = new Function(code);
          fn();
        } catch (err) {
          console.warn("[inline-html] Script error:", err);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="my-2 inline-html-render"
      style={{ minHeight: "50px" }}
    />
  );
}

function ToolCallCard({ part, onApprovalExecuted, onOpenArtifact }: { part: ToolPart; onApprovalExecuted?: (result: string) => void; onOpenArtifact?: (artifact: ActiveArtifact) => void }) {
  const isDone = part.state === "output-available" || part.state === "output-error";
  const output = isDone && "output" in part ? part.output : undefined;
  const errorText = "errorText" in part ? part.errorText : undefined;
  const isDynamic = part.type === "dynamic-tool";

  // express tool: render dot art inline — completely invisible as a tool call
  if (part.type === "tool-express") {
    if (!isDone) return null; // Hide while generating
    if (isDone && output && typeof output === "object" && (output as Record<string, unknown>).type === "dot-expression") {
      const expr = output as { points: { x: number; y: number }[]; size: number; concept: string };
      if (expr.points.length === 0) return null;
      return (
        <div className="my-2 flex justify-center">
          <NeuralMorph
            size={expr.size}
            dotCount={expr.points.length}
            customPoints={expr.points}
          />
        </div>
      );
    }
    return null;
  }

  // review_compliance tool: render checklist inline
  if (part.type === "tool-review_compliance") {
    if (!isDone) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Reviewing against rules and guidelines...</span>
        </div>
      );
    }
    // Fall through to the compliance review renderer below
  }

  // ask_user tool: show compact summary once answered, hide while pending (InterviewUI handles it)
  if (part.type === "tool-ask_user") {
    if (part.state === "input-available") return null; // InterviewUI renders above prompt
    if (part.state === "output-available" && "output" in part) {
      try {
        const answers = typeof part.output === "string" ? JSON.parse(part.output) : part.output;
        if (answers?._skipped) {
          return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <MessageSquareText className="h-3.5 w-3.5" />
              <span>Question skipped</span>
            </div>
          );
        }
        const input = "input" in part ? (part.input as { title?: string }) : {};
        return (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquareText className="h-3.5 w-3.5" />
              <span className="font-medium">{input?.title ?? "User Response"}</span>
            </div>
            {Object.entries(answers as Record<string, unknown>).map(([key, val]) => (
              <div key={key} className="flex gap-2">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-medium">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
              </div>
            ))}
          </div>
        );
      } catch {
        // Fall through to default rendering
      }
    }
  }

  // Check if this is an approval proposal
  const isApproval = isDone && output && typeof output === "object" && "approval_id" in (output as Record<string, unknown>);
  const approvalOutput = isApproval ? output as Record<string, unknown> : null;

  // Inline visuals are handled via ```html blocks in RichMessageResponse

  // Check if this is a compliance review result
  const isComplianceReview = isDone && output && typeof output === "object"
    && (output as Record<string, unknown>).type === "compliance-review";
  if (isComplianceReview) {
    const review = output as {
      content_label: string;
      checks: { id: string; source: string; rule: string; status: string; explanation: string }[];
      summary: { total: number; passed: number; failed: number; warnings: number; score: number };
      error?: string;
    };
    if (review.error) {
      return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <span className="text-amber-500">⚠</span> {review.error}
        </div>
      );
    }
    const scoreColor = review.summary.score >= 80 ? "text-green-500" : review.summary.score >= 50 ? "text-amber-500" : "text-red-500";
    return (
      <div className="my-3 space-y-3 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Compliance Review: {review.content_label}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-500">✓ {review.summary.passed}</span>
            <span className="text-red-500">✗ {review.summary.failed}</span>
            {review.summary.warnings > 0 && <span className="text-amber-500">⚠ {review.summary.warnings}</span>}
            <span className={`font-bold ${scoreColor}`}>{review.summary.score}%</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
          {review.summary.passed > 0 && (
            <div className="bg-green-500 h-full" style={{ width: `${(review.summary.passed / review.summary.total) * 100}%` }} />
          )}
          {review.summary.warnings > 0 && (
            <div className="bg-amber-500 h-full" style={{ width: `${(review.summary.warnings / review.summary.total) * 100}%` }} />
          )}
          {review.summary.failed > 0 && (
            <div className="bg-red-500 h-full" style={{ width: `${(review.summary.failed / review.summary.total) * 100}%` }} />
          )}
        </div>
        {/* Checklist */}
        <div className="space-y-1.5">
          {review.checks.map((check, i) => (
            <div key={check.id ?? i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 mt-0.5">
                {check.status === "pass" ? (
                  <span className="text-green-500">✓</span>
                ) : check.status === "fail" ? (
                  <span className="text-red-500">✗</span>
                ) : (
                  <span className="text-amber-500">⚠</span>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-muted-foreground">[{check.source}]</span>
                  <span className={check.status === "fail" ? "text-red-400" : ""}>{check.rule}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">{check.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Check if this is an artifact_get result — auto-open artifact panel
  if (part.type === "tool-artifact_get" && isDone && output && typeof output === "object") {
    const artOut = output as Record<string, unknown>;
    if (artOut.error) {
      // Fall through to default rendering for errors
    } else if (artOut.artifactId && artOut.code !== undefined) {
      const artType = artOut.type as string | undefined;
      const isDoc = artType === "document";
      const artFiles = Array.isArray(artOut.files)
        ? (artOut.files as { path: string; content: string }[])
        : undefined;
      return (
        <button
          onClick={() => onOpenArtifact?.({
            filename: String(artOut.filename ?? "Untitled"),
            language: String(artOut.language ?? "text"),
            code: String(artOut.code ?? ""),
            type: isDoc ? "document" : "code",
            artifactId: String(artOut.artifactId),
            currentVersion: typeof artOut.currentVersion === "number" ? artOut.currentVersion : undefined,
            description: typeof artOut.description === "string" ? artOut.description : undefined,
            files: artFiles,
            previewUrl: typeof artOut.previewUrl === "string" ? artOut.previewUrl : undefined,
            snapshotId: typeof artOut.snapshotId === "string" ? artOut.snapshotId : undefined,
            runCommand: typeof artOut.runCommand === "string" ? artOut.runCommand : undefined,
            exposePort: typeof artOut.exposePort === "number" ? artOut.exposePort : undefined,
          })}
          className="flex items-center gap-3 w-full max-w-sm rounded-lg border bg-card px-4 py-3 text-left hover:bg-accent/50 transition-colors group/artifact"
        >
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md shrink-0", isDoc ? "bg-blue-500/10 text-blue-500" : "bg-primary/10 text-primary")}>
            {isDoc ? <FileText className="h-4 w-4" /> : <FileCode2 className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{String(artOut.filename ?? "Untitled")}</p>
            <p className="text-xs text-muted-foreground">
              {isDoc ? "Document" : String(artOut.language ?? "code")}
              {artFiles && artFiles.length > 1 ? ` — ${artFiles.length} files` : ""}
              {" — Click to open"}
            </p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/artifact:opacity-100 transition-opacity shrink-0" />
        </button>
      );
    }
  }

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

    // Extract multi-file project files if available
    const sFiles = Array.isArray(sbox.files)
      ? (sbox.files as { path: string; content: string }[])
      : undefined;
    const sFileCount = typeof sbox.fileCount === "number" ? sbox.fileCount : undefined;

    const sSnapshotId = typeof sbox.snapshotId === "string" ? sbox.snapshotId : undefined;
    const sRunCommand = typeof sbox.runCommand === "string" ? sbox.runCommand : undefined;
    const sExposePort = typeof sbox.exposePort === "number" ? sbox.exposePort : undefined;
    const sArtifactId = typeof sbox.artifactId === "string" ? sbox.artifactId : undefined;

    // If we have a previewUrl AND code AND it succeeded, show artifact card
    if (sPreviewUrl && sCode && sExitCode === 0) {
      return (
        <button
          onClick={() => onOpenArtifact?.({
            filename: sFilename,
            language: sLanguage,
            code: sCode,
            previewUrl: sPreviewUrl,
            description: sExitCode === 0 ? undefined : `Exit code: ${sExitCode}`,
            files: sFiles,
            snapshotId: sSnapshotId,
            runCommand: sRunCommand,
            exposePort: sExposePort,
            artifactId: sArtifactId,
          })}
          className="flex items-center gap-3 w-full max-w-sm rounded-lg border bg-card px-4 py-3 text-left hover:bg-accent/50 transition-colors group/artifact"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <FileCode2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{sFilename}</p>
            <p className="text-xs text-muted-foreground">
              {sFileCount && sFileCount > 1 ? `${sFileCount} files` : sLanguage} — Click to open
            </p>
            {sSnapshotId && <p className="text-[10px] text-green-600 mt-0.5">Snapshot saved — can restart anytime</p>}
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/artifact:opacity-100 transition-opacity shrink-0" />
        </button>
      );
    }

    // Multi-file project → show as artifact card so user can browse all files
    if (sFiles && sFiles.length > 1) {
      return (
        <button
          onClick={() => onOpenArtifact?.({
            filename: sFilename,
            language: sLanguage,
            code: sCode,
            description: sExitCode === 0 ? `${sFiles.length} files` : `Exit code: ${sExitCode}`,
            files: sFiles,
            previewUrl: sPreviewUrl ?? undefined,
            artifactId: sArtifactId,
          })}
          className="flex items-center gap-3 w-full max-w-sm rounded-lg border bg-card px-4 py-3 text-left hover:bg-accent/50 transition-colors group/artifact"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <FileCode2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{sFilename}</p>
            <p className="text-xs text-muted-foreground">{sFiles.length} files — Click to open</p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/artifact:opacity-100 transition-opacity shrink-0" />
        </button>
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

  // Check if this is a web search result from web_search
  const isWebSearch = isDone && output && typeof output === "object"
    && "result" in (output as Record<string, unknown>)
    && "source" in (output as Record<string, unknown>)
    && "query" in (output as Record<string, unknown>);

  if (isWebSearch) {
    const ws = output as Record<string, unknown>;
    const wsError = typeof ws.error === "string" ? ws.error : null;
    const wsResult = String(ws.result ?? "");
    // Use Perplexity's provider citations if available, fall back to URL extraction
    const providerCitations = Array.isArray(ws.citations)
      ? (ws.citations as { index: number; url: string }[]).map(c => ({ title: getHostname(c.url), url: c.url }))
      : [];
    const citations = providerCitations.length > 0 ? providerCitations : extractUrls(wsResult);
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium truncate">Search: {String(ws.query)}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{String(ws.source)}</span>
        </div>
        {wsError ? (
          <div className="p-3 text-sm text-red-600">{wsError}</div>
        ) : (
          <div className="p-3 text-sm prose prose-sm dark:prose-invert max-w-none prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            <MessageResponse>{wsResult}</MessageResponse>
          </div>
        )}
        {citations.length > 0 ? (
          <div className="px-3 py-2 bg-muted/30 border-t space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-accent transition-colors relative"
                  title={c.url}
                >
                  <span className="font-medium text-primary">[{i + 1}]</span>
                  <span className="text-muted-foreground truncate max-w-[180px]">{c.title}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          </div>
        ) : !wsError && (
          <div className="px-3 py-2 bg-muted/30 border-t">
            <p className="text-[10px] text-muted-foreground">Search powered by Perplexity — results may include information from multiple sources</p>
          </div>
        )}
      </div>
    );
  }

  // Check if this is a document artifact from create_document or edit_document
  const isDocArtifact = isDone && output && typeof output === "object" && "type" in (output as Record<string, unknown>) && (output as Record<string, unknown>).type === "document";
  const docOutput = isDocArtifact ? output as Record<string, unknown> : null;

  if (docOutput) {
    const docTitle = (docOutput.title as string) ?? "Document";
    const docContent = (docOutput.content as string) ?? "";
    const docDescription = docOutput.description as string | undefined;
    const docId = docOutput.documentId as string | undefined;
    return (
      <button
        onClick={() => onOpenArtifact?.({
          filename: `${docTitle}.html`,
          language: "html",
          code: docContent,
          description: docDescription ?? (docOutput.editDescription as string | undefined) ?? docOutput.message as string | undefined,
          contextId: docId,
          type: "document",
        })}
        className="flex items-center gap-3 w-full max-w-sm rounded-lg border bg-card px-4 py-3 text-left hover:bg-accent/50 transition-colors group/artifact"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-500 shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{docTitle}</p>
          <p className="text-xs text-muted-foreground">
            Document — Click to open editor
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/artifact:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  }

  // Check if this is a code artifact from write_code
  // Code artifact = has code + language but NOT exitCode (sandbox results have exitCode)
  const isCodeArtifact = isDone && output && typeof output === "object" && "code" in (output as Record<string, unknown>) && "language" in (output as Record<string, unknown>) && !("exitCode" in (output as Record<string, unknown>));
  const codeOutput = isCodeArtifact ? output as Record<string, unknown> : null;

  // Render code artifact as a compact card that opens the artifact panel
  if (codeOutput) {
    const artFilename = codeOutput.filename as string;
    const artLanguage = codeOutput.language as string;
    const artCode = codeOutput.code as string;
    const artDescription = codeOutput.message as string | undefined;
    const artContextId = codeOutput.context_id as string | undefined;
    return (
      <button
        onClick={() => onOpenArtifact?.({ filename: artFilename, language: artLanguage, code: artCode, description: artDescription, contextId: artContextId })}
        className="flex items-center gap-3 w-full max-w-sm rounded-lg border bg-card px-4 py-3 text-left hover:bg-accent/50 transition-colors group/artifact"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
          <FileCode2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{artFilename}</p>
          <p className="text-xs text-muted-foreground">
            {artLanguage}{artDescription ? ` — ${artDescription}` : " — Click to open"}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/artifact:opacity-100 transition-opacity shrink-0" />
      </button>
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
          onExecuted={onApprovalExecuted}
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
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleThumbsUp}
          disabled={!!selected}
          className={cn(
            "p-1 rounded transition-colors",
            selected === "positive"
              ? "text-primary"
              : "text-primary/60 hover:text-primary"
          )}
          aria-label="Thumbs up"
          data-testid="feedback-thumbs-up"
        >
          <ThumbsUp className={cn("h-3 w-3", selected === "positive" && "fill-current")} />
        </button>
        <button
          type="button"
          onClick={handleThumbsDown}
          disabled={!!selected}
          className={cn(
            "p-1 rounded transition-colors",
            selected === "negative"
              ? "text-red-400"
              : "text-red-400/60 hover:text-red-400"
          )}
          aria-label="Thumbs down"
          data-testid="feedback-thumbs-down"
        >
          <ThumbsDown className={cn("h-3 w-3", selected === "negative" && "fill-current")} />
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
  initialPrompt?: string | null;
}

export function ChatInterface({ conversationId, initialTemplateId, initialPrompt }: ChatInterfaceProps) {
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
      initialPrompt={initialPrompt}
      initialMessages={initialMessages}
    />
  );
}

interface ChatInterfaceInnerProps {
  conversationId?: string | null;
  initialTemplateId?: string | null;
  initialPrompt?: string | null;
  initialMessages?: UIMessage[];
}

function ChatInterfaceInner({ conversationId, initialTemplateId, initialPrompt, initialMessages }: ChatInterfaceInnerProps) {
  const [model, setModel] = useState<string>("google/gemini-3.1-flash-lite-preview");
  const [showContextBar, setShowContextBar] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [visualLevel, setVisualLevel] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("granger-visual-level") ?? "medium";
    return "medium";
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const [activeTemplate, setActiveTemplate] = useState<AgentTemplate | null>(
    initialTemplateId ? AGENT_TEMPLATES.find((t) => t.id === initialTemplateId) ?? null : null,
  );

  const { messages, sendMessage, addToolOutput, status, error, stop } = useChat({
    messages: initialMessages && initialMessages.length > 0 ? initialMessages : undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { model, conversationId, visualLevel },
    }),
    onFinish: () => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const promptSentRef = useRef(false);

  // Detect pending ask_user tool calls that need user interaction
  const pendingInterview = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const parts = m.parts as { type: string; state?: string; toolCallId?: string; input?: Record<string, unknown> }[];
      for (const part of parts) {
        if (part.type === "tool-ask_user" && part.state === "input-available" && part.input) {
          return {
            toolCallId: part.toolCallId!,
            title: (part.input.title as string) ?? "Question",
            description: part.input.description as string | undefined,
            questions: (part.input.questions as { id: string; label: string; type: "choice" | "text" | "multiselect"; options?: string[]; placeholder?: string; required?: boolean }[]) ?? [],
          };
        }
      }
    }
    return null;
  })();

  const handleInterviewSubmit = useCallback((toolCallId: string, answers: Record<string, string | string[]>) => {
    // Don't await — avoid deadlocks
    addToolOutput({
      tool: "ask_user",
      toolCallId,
      output: JSON.stringify(answers),
    });
  }, [addToolOutput]);

  const handleInterviewDismiss = useCallback((toolCallId: string) => {
    addToolOutput({
      tool: "ask_user",
      toolCallId,
      output: JSON.stringify({ _skipped: true }),
    });
  }, [addToolOutput]);

  // Auto-send initial prompt from URL (e.g., sandbox "Try It" buttons)
  useEffect(() => {
    if (initialPrompt && !promptSentRef.current && messages.length === 0) {
      promptSentRef.current = true;
      sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, messages.length, sendMessage]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const valid: PendingFile[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} exceeds 10MB limit`);
        continue;
      }
      if (!ACCEPTED_FILE_TYPES.includes(file.type) && !file.name.match(/\.(md|txt|csv)$/i)) {
        alert(`${file.name}: unsupported file type`);
        continue;
      }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      valid.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, previewUrl });
    }
    setPendingFiles(prev => [...prev, ...valid]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles(prev => {
      const removed = prev.find(f => f.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // Convert pending files to a DataTransfer-backed FileList for sendMessage
  const buildFileList = useCallback((): FileList | undefined => {
    if (pendingFiles.length === 0) return undefined;
    const dt = new DataTransfer();
    for (const pf of pendingFiles) dt.items.add(pf.file);
    return dt.files;
  }, [pendingFiles]);

  const [shareOpen, setShareOpen] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const prevSourceCountRef = useRef(0);
  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifact | null>(null);
  const [artifactViewMode, setArtifactViewMode] = useState<"code" | "preview">("code");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);
  const [sandboxRestarting, setSandboxRestarting] = useState(false);

  // Load context panel preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("chat-context-panel");
    if (stored === "true") setContextPanelOpen(true);
  }, []);

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

  // Dynamic skill slash commands fetched from API
  const [skillMenuItems, setSkillMenuItems] = useState<{ cmd: string; label: string; description: string; icon: string }[]>([]);
  // Dynamic MCP server slash commands
  const [mcpMenuItems, setMcpMenuItems] = useState<{ cmd: string; label: string; description: string; icon: string; toolNames: string[] }[]>([]);

  useEffect(() => {
    // Fetch skills
    fetch("/api/skills")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.skills) return;
        const items = (data.skills as { slug: string; name: string; description: string; icon: string; slash_command: string | null; is_active: boolean }[])
          .filter((s) => s.is_active && s.slash_command)
          .map((s) => ({
            cmd: s.slash_command!,
            label: s.name,
            description: s.description,
            icon: s.icon,
          }));
        setSkillMenuItems(items);
      })
      .catch(() => {});

    // Fetch active MCP servers to generate auto-commands
    fetch("/api/mcp-servers")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.servers) return;
        const items = (data.servers as { name: string; is_active: boolean; discovered_tools: { name: string }[] | null }[])
          .filter((s) => s.is_active)
          .map((s) => {
            const slug = s.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
            const toolNames = (s.discovered_tools ?? []).map((t) => t.name);
            return {
              cmd: `/${slug}`,
              label: s.name,
              description: toolNames.length > 0
                ? `${toolNames.length} MCP tools: ${toolNames.slice(0, 3).join(", ")}${toolNames.length > 3 ? "..." : ""}`
                : "MCP server",
              icon: "🔌",
              toolNames,
            };
          });
        setMcpMenuItems(items);
      })
      .catch(() => {});
  }, []);

  // Slash command definitions with metadata for the autocomplete menu
  const SLASH_MENU_ITEMS = [
    { cmd: "/linear", label: "Linear", description: "Query issues, create tasks", icon: "⚡" },
    { cmd: "/tasks", label: "Tasks", description: "Show in-progress tasks", icon: "📋" },
    { cmd: "/gmail", label: "Gmail", description: "Search and draft emails", icon: "✉️" },
    { cmd: "/notion", label: "Notion", description: "Search pages and databases", icon: "📝" },
    { cmd: "/granola", label: "Granola", description: "Meeting transcripts", icon: "🎙️" },
    { cmd: "/drive", label: "Drive", description: "Search Google Drive files", icon: "📁" },
    { cmd: "/github", label: "GitHub", description: "Repos, PRs, issues, commits", icon: "🐙" },
    { cmd: "/schedule", label: "Schedule", description: "View scheduled actions", icon: "⏰" },
    { cmd: "/approve", label: "Approve", description: "Pending approvals", icon: "✅" },
    { cmd: "/status", label: "Status", description: "Full status summary", icon: "📊" },
    { cmd: "/run", label: "Run Code", description: "Execute code in sandbox", icon: "▶️" },
    { cmd: "/skills", label: "Skills", description: "Browse and manage skills", icon: "🧩" },
    { cmd: "/skill create", label: "Create Skill", description: "Create a new custom skill via interview", icon: "🛠️" },
    { cmd: "/review", label: "Review", description: "Check content against rules & guidelines", icon: "📋" },
    { cmd: "/ingest", label: "Ingest Repo", description: "Import GitHub repo to context", icon: "📥" },
    { cmd: "/web", label: "Browse URL", description: "Fetch and read a web page", icon: "🌐" },
    { cmd: "/search", label: "Search", description: "Search the web", icon: "🔍" },
    { cmd: "/help", label: "Help", description: "List all commands", icon: "❓" },
    // Dynamic skill commands appended from API
    ...skillMenuItems.filter((si) => ![ "/linear", "/tasks", "/gmail", "/notion", "/granola", "/drive", "/schedule", "/approve", "/status", "/run", "/search", "/skills", "/help", "/email" ].includes(si.cmd)),
    // Dynamic MCP server commands
    ...mcpMenuItems.filter((mi) => ![ "/linear", "/gmail", "/notion", "/granola", "/drive", "/github" ].includes(mi.cmd)),
  ];

  // Slash command mappings — expand to explicit tool instructions for the AI
  const SLASH_COMMANDS: Record<string, (args: string) => string> = {
    "/linear": (args) => args ? `Use the ask_linear_agent tool to find issues matching: ${args}` : "Use the ask_linear_agent tool to show all my current issues",
    "/tasks": (args) => args ? `Use the ask_linear_agent tool to find: ${args}` : "Use the ask_linear_agent tool to show my in-progress tasks",
    "/gmail": (args) => args ? `Use the ask_gmail_agent tool to search emails: ${args}` : "Use the ask_gmail_agent tool to show my recent emails from the last 3 days",
    "/email": (args) => args ? `Use the ask_gmail_agent tool to search: ${args}` : "Use the ask_gmail_agent tool to show my recent emails",
    "/notion": (args) => args ? `Use the ask_notion_agent tool to find: ${args}` : "Use the ask_notion_agent tool to list my pages",
    "/granola": (args) => args
      ? `Search my Granola meetings about: ${args}. Prefer MCP tools (query_granola_meetings, list_meetings, get_meeting_transcript) if available, otherwise fall back to ask_granola_agent.`
      : "Show my recent Granola meetings. Prefer MCP tools (list_meetings, get_meetings) if available, otherwise fall back to ask_granola_agent.",
    "/drive": (args) => args ? `Use the ask_drive_agent tool to search for: ${args}` : "Use the ask_drive_agent tool to show my recent files",
    "/github": (args) => args
      ? `Use GitHub MCP tools to: ${args}. Available tools include: list_issues, search_code, list_pull_requests, list_commits, get_file_contents, create_pull_request, search_repositories.`
      : "Use GitHub MCP tools to show my recent GitHub activity. Try list_issues or list_pull_requests to see what's open.",
    "/ingest": (args) => args
      ? `Use the ingest_github_repo tool to import the repository "${args}" into the context library. Clone it, read the key files (README, src/, lib/, package.json, etc.), skip node_modules/.git/binaries, and save as context items.`
      : "Use the ingest_github_repo tool. Ask me which GitHub repository to import (e.g., owner/repo).",
    "/approve": () => "Use the list_approvals tool to show all pending items in the approval queue",
    "/status": () => "Give me a full status update: check pending approvals, overdue tasks, and recent context items",
    "/schedule": () => "Show me all scheduled actions and their status",
    "/run": (args) => args ? `Use run_code to execute: ${args}` : "Use run_code to execute code in a sandbox. Ask me what to run.",
    "/skills": (args) => args
      ? `Search for skills matching "${args}". Check the /skills page to browse and install skills from the skills.sh registry.`
      : "Show me available skills. I have 6 built-in skills and 24+ marketplace skills available at /skills.",
    "/skill": (args) => {
      if (args.toLowerCase().startsWith("create")) {
        const extra = args.slice(6).trim();
        return extra
          ? `I want to create a new custom skill${extra ? `: ${extra}` : ""}. Use the ask_user tool to interview me about the skill details (name, description, category, what tools it needs, and a system prompt), then use create_skill to save it.`
          : "I want to create a new custom skill. Use the ask_user tool to interview me about the skill details (name, description, category, what tools it needs, and a system prompt), then use create_skill to save it.";
      }
      return args
        ? `Search for skills matching "${args}". Check the /skills page.`
        : "Show me available skills at /skills.";
    },
    "/review": (args) => args
      ? `Use the review_compliance tool to check the following content against all our org rules and priority documents: ${args}`
      : "Use the review_compliance tool. What content would you like me to review against our rules and guidelines? You can paste text, a URL, or reference a document.",
    "/web": (args) => args ? `Use the web_browse tool to fetch and read this URL: ${args}` : "Use the web_browse tool. What URL would you like me to read?",
    "/search": (args) => args ? `Use the web_search tool to search the web for: ${args}` : "Use the web_search tool. What would you like me to search for?",
    "/help": () => "List all available slash commands: /linear, /tasks, /gmail, /notion, /granola, /drive, /approve, /status, /schedule, /run, /search, /skills, /skill create, /pm, /email, /meeting, /code, /weekly, /brand",
    // Dynamic skill slash commands → activate_skill tool
    ...Object.fromEntries(
      skillMenuItems.map((si) => [
        si.cmd,
        (args: string) => {
          const slug = si.cmd.replace(/^\//, "");
          return args
            ? `Use the activate_skill tool with skill_slug "${slug}". Then help me with: ${args}`
            : `Use the activate_skill tool with skill_slug "${slug}"`;
        },
      ])
    ),
    // Dynamic MCP server slash commands → use MCP tools
    ...Object.fromEntries(
      mcpMenuItems.map((mi) => [
        mi.cmd,
        (args: string) => {
          const toolList = mi.toolNames.length > 0
            ? `Available MCP tools from ${mi.label}: ${mi.toolNames.join(", ")}.`
            : `Use ${mi.label} MCP tools.`;
          return args
            ? `${toolList} Help me with: ${args}`
            : `${toolList} What can this server do?`;
        },
      ])
    ),
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
    if ((!text && pendingFiles.length === 0) || isLoading) return;

    // Default text when sending files without a message
    if (!text && pendingFiles.length > 0) {
      text = "Please analyze the attached file(s).";
    }

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

    const files = buildFileList();
    setInput("");
    // Clean up object URLs before clearing
    for (const pf of pendingFiles) {
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
    }
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    sendMessage({ text, files });
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

  // Auto-open context panel when new search results arrive
  useEffect(() => {
    if (latestSources.length > 0 && prevSourceCountRef.current === 0) {
      setContextPanelOpen(true);
      localStorage.setItem("chat-context-panel", "true");
    }
    prevSourceCountRef.current = latestSources.length;
  }, [latestSources.length]);

  const toggleContextPanel = () => {
    setContextPanelOpen((prev) => {
      const next = !prev;
      localStorage.setItem("chat-context-panel", String(next));
      return next;
    });
  };

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
              <div className="mb-3 opacity-60">
                <NeuralMorph size={48} dotCount={14} formation="bloom" />
              </div>
              <p className="text-sm font-medium text-foreground">Ask anything about your team&apos;s knowledge</p>
              <p className="text-xs mt-1">Granger searches your documents, meetings, and notes to answer.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-lg">
                {[
                  { text: "Chart my overdue Linear tasks by priority", accent: true },
                  { text: "Research competitor pricing and write a brief", accent: false },
                  { text: "Summarize my last Granola meeting into action items", accent: false },
                  { text: "Build a dashboard app from our recent metrics", accent: true },
                  { text: "Look up our brand guidelines and create a landing page", accent: false },
                  { text: "Show my week ahead — tasks, meetings, deadlines", accent: true },
                ].map(({ text: prompt, accent }) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage({ text: prompt })}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                      accent
                        ? "border-primary/30 text-primary hover:bg-primary/10"
                        : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, idx) => {
            const parts = m.parts as { type: string; text?: string }[];
            const text = getTextContent(parts);
            const toolParts = m.role === "assistant" ? getToolParts(parts) : [];
            const sources = getSearchSources(toolParts);

            const fileParts = (parts as { type: string }[]).filter(p => p.type === "file");
            if (!text && toolParts.length === 0 && fileParts.length === 0 && m.role !== "user") return null;

            const isLastAssistant =
              m.role === "assistant" &&
              m === messages.filter((msg) => msg.role === "assistant").at(-1);
            const isStreaming = isLastAssistant && isLoading;

            return (
              <div key={m.id} className={cn("flex gap-3 group", m.role === "user" ? "max-w-3xl ml-auto flex-row-reverse" : "max-w-4xl")}>
                {m.role === "user" ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    <User className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="rounded-full overflow-hidden shrink-0" style={{ width: 36, height: 36 }}>
                    {(() => {
                      const msgToolNames = toolParts.map(p => {
                        const type = (p as { type: string }).type;
                        return type.startsWith("tool-") ? type.slice(5) : type === "dynamic-tool" && "toolName" in p ? String(p.toolName) : "";
                      }).filter(Boolean);

                      // Check for emotion in text
                      const { formation: emotionFormation } = text ? parseEmotion(text) : { formation: null };

                      const formation = emotionFormation
                        ? emotionFormation
                        : isStreaming
                        ? getActiveFormation(msgToolNames)
                        : isLastAssistant
                        ? getDoneFormation(msgToolNames)
                        : getOldFormation();

                      return <NeuralMorph size={40} dotCount={isStreaming ? 16 : isLastAssistant ? 14 : 10} formation={formation} />;
                    })()}
                  </div>
                )}

                <Message from={m.role} className="min-w-0 flex-1">
                  {/* Tool call cards */}
                  {toolParts.length > 0 && (
                    <div className="space-y-2">
                      {toolParts.map((part, i) => (
                        <ToolCallCard key={i} part={part} onApprovalExecuted={(result) => sendMessage({ text: `[Approval result: ${result}]. Acknowledge this and tell me the final outcome.` })} onOpenArtifact={(artifact) => { setActiveArtifact(artifact); setArtifactViewMode("code"); setSelectedFilePath(artifact.files?.[0]?.path ?? null); }} />
                      ))}
                    </div>
                  )}

                  {/* File attachments in messages */}
                  {(() => {
                    const fileParts = (parts as { type: string; mediaType?: string; url?: string; filename?: string }[])
                      .filter(p => p.type === "file");
                    if (fileParts.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mb-1">
                        {fileParts.map((fp, fi) => (
                          fp.mediaType?.startsWith("image/") ? (
                            <img
                              key={fi}
                              src={fp.url}
                              alt={fp.filename ?? "attachment"}
                              className="max-h-40 rounded-lg border object-cover"
                            />
                          ) : (
                            <div key={fi} className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                              <FileType className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{fp.filename ?? "file"}</span>
                            </div>
                          )
                        ))}
                      </div>
                    );
                  })()}

                  {/* Text response — with inline json-render detection */}
                  {text && (
                    <MessageContent>
                      {m.role === "user" ? (
                        text
                      ) : (
                        <RichMessageResponse text={text.replace(/\[(?:emotion|mood|feeling):\w+(?::\d+)?\]/g, "")} />
                      )}
                    </MessageContent>
                  )}

                  {/* Source citations */}
                  {sources.length > 0 && (
                    <SourceCitation sources={sources} />
                  )}

                  {/* Actions row — copy, branch (both roles), feedback + cost (assistant only) */}
                  {!isStreaming && text && (
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => navigator.clipboard.writeText(text)} className="p-1 rounded hover:bg-muted transition-colors" title="Copy"><Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" /></button>
                      {conversationId && (
                        <button onClick={async () => { try { const res = await fetch("/api/chat/branch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, messageIndex: idx }) }); if (res.ok) { const { conversationId: newId } = await res.json(); window.location.href = `/chat?id=${newId}`; } } catch {} }} className="p-1 rounded hover:bg-muted transition-colors" title="Branch"><GitBranch className="h-3 w-3 text-primary/60 hover:text-primary" /></button>
                      )}
                      {m.role === "assistant" && (
                        <>
                          <MessageFeedback messageId={m.id} conversationId={conversationId} />
                          <span className="text-[10px] text-muted-foreground/40 ml-1">~${((text.length / 4 / 1_000_000) * (model?.includes("opus") ? 75 : model?.includes("sonnet") ? 15 : 1)).toFixed(4)}</span>
                        </>
                      )}
                    </div>
                  )}
                </Message>
              </div>
            );
          })}

          {/* Only show thinking indicator when loading AND no streaming message exists yet */}
          {isLoading && !messages.some(m => m.role === "assistant" && m === messages.filter(msg => msg.role === "assistant").at(-1) && getTextContent(m.parts as { type: string; text?: string }[])) && (
            <div className="flex gap-3 max-w-4xl">
              <div className="rounded-full overflow-hidden shrink-0" style={{ width: 36, height: 36 }}>
                <NeuralMorph size={40} dotCount={16} formation="active" />
              </div>
              <span className="text-xs text-muted-foreground pt-3">Thinking…</span>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error.message ?? "Something went wrong."}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <div
          className="p-3 sm:p-4 pb-6 relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag-drop overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg m-1">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">Drop files here</span>
                <span className="text-xs text-muted-foreground">Images, PDFs, text files (max 10MB)</span>
              </div>
            </div>
          )}

          <div className="max-w-5xl mx-auto rounded-2xl border bg-card/80 backdrop-blur shadow-lg p-3">
            {/* Interview UI — renders as overlay above the input area */}
            {pendingInterview && (
              <div className="absolute bottom-full left-0 right-0 mb-2 px-4 z-10">
                <InterviewUI
                  interview={pendingInterview}
                  onSubmit={handleInterviewSubmit}
                  onDismiss={handleInterviewDismiss}
                />
              </div>
            )}

            {/* Slash command autocomplete menu — positioned above input */}
            {slashMenuFiltered.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 z-20 px-3 sm:px-4">
                <div className="max-w-5xl mx-auto">
                  <div className="border rounded-lg bg-background shadow-lg max-h-[calc(8*2.5rem)] overflow-y-auto">
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
              </div>
            )}

              {/* Pending file previews */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {pendingFiles.map(pf => {
                    const Icon = getFileIcon(pf.file.type);
                    return (
                      <div key={pf.id} className="group/file relative flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs">
                        {pf.previewUrl ? (
                          <img src={pf.previewUrl} alt={pf.file.name} className="h-6 w-6 rounded object-cover" />
                        ) : (
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate max-w-[100px] text-muted-foreground">{pf.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(pf.id)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={`Remove ${pf.file.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <div className="flex items-end gap-2">
                <textarea
                  data-testid="chat-input"
                  aria-label="Chat message input"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-expand textarea
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 200) + "px";
                  }}
                  placeholder="Ask about your documents, meetings, or team… (type / for commands)"
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm focus:outline-none placeholder:text-muted-foreground"
                  style={{ maxHeight: "200px", overflowY: "auto" }}
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

                {/* Right-side icon buttons */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach files"
                    title="Attach files"
                    className="h-8 w-8"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowContextBar(prev => !prev)}
                    aria-label="Toggle context window"
                    title="Context window"
                    className="h-8 w-8"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>

                  {/* Settings dropdown — model selector + visual level */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Chat settings" title="Chat settings">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-3 space-y-3">
                      {/* Model selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Model</label>
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger className="w-full text-xs h-8" data-testid="model-selector" aria-label="Select AI model">
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
                      </div>
                      <DropdownMenuSeparator />
                      {/* Visual level */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Visual Level</label>
                        <div className="flex items-center border rounded-md overflow-hidden">
                          {(["off", "low", "med", "high"] as const).map((lvl) => {
                            const value = lvl === "med" ? "medium" : lvl;
                            const isActive = visualLevel === value;
                            return (
                              <button
                                key={lvl}
                                onClick={() => {
                                  setVisualLevel(value);
                                  localStorage.setItem("granger-visual-level", value);
                                }}
                                className={cn(
                                  "flex-1 px-2 py-1 text-[10px] font-medium transition-colors",
                                  isActive
                                    ? "bg-primary/15 text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                title={`Visual mode: ${value}`}
                              >
                                {lvl === "off" ? "○" : lvl === "low" ? "◔" : lvl === "med" ? "◑" : "●"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Context window stats preview */}
                      {messages.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Context</label>
                            <p className="text-[10px] text-muted-foreground">{messages.length} messages in conversation</p>
                          </div>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Send / Stop button */}
                {isLoading ? (
                  <Button type="button" size="icon" onClick={stop} variant="destructive" aria-label="Stop generation" data-testid="chat-stop" className="h-8 w-8 shrink-0">
                    <Square className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button type="button" size="icon" onClick={handleSend} disabled={!input.trim() && pendingFiles.length === 0} data-testid="chat-submit" aria-label="Send message" className="h-8 w-8 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
          </div>
          {/* Context window bar — pops up above prompt area */}
          {showContextBar && messages.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 px-4 z-10">
              <div className="max-w-5xl mx-auto">
                <ContextWindowBar messages={messages} modelId={model} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — Artifact viewer with file tree (mini IDE) */}
      {activeArtifact ? (
        <aside className="hidden md:flex w-[50%] min-w-[400px] shrink-0 border-l bg-card">
          {(() => {
            // Build file tree from multi-file project or single file
            const artifactFiles = activeArtifact.files?.length
              ? activeArtifact.files
              : [{ path: activeArtifact.filename, content: activeArtifact.code }];
            const tree = buildFileTree(artifactFiles);
            const currentPath = selectedFilePath ?? artifactFiles[0]?.path ?? null;
            const currentNode = currentPath ? findFileNode(tree, currentPath) : null;
            const displayCode = currentNode?.content ?? activeArtifact.code;
            const displayLang = currentNode?.language ?? activeArtifact.language;
            const displayName = currentNode?.name ?? activeArtifact.filename;

            return (
              <>
                {/* File tree sidebar — collapsible */}
                {fileTreeCollapsed ? (
                  <div className="shrink-0 border-r flex flex-col bg-muted/20">
                    <button
                      onClick={() => setFileTreeCollapsed(false)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                      aria-label="Expand file tree"
                      title="Show files"
                    >
                      <PanelRightOpen className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-44 shrink-0 border-r flex flex-col bg-muted/20">
                    <div className="px-3 py-2 border-b flex items-center justify-between">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Files</p>
                      <button
                        onClick={() => setFileTreeCollapsed(true)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Collapse file tree"
                        title="Hide files"
                      >
                        <PanelRightClose className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <FileTree
                        files={tree}
                        selectedPath={currentPath}
                        onSelectFile={(path) => { setSelectedFilePath(path); setArtifactViewMode("code"); }}
                      />
                    </div>
                  </div>
                )}

                {/* Code/Preview area — or TipTap editor for documents */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Header bar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b">
                    <div className="flex items-center gap-2 min-w-0">
                      {activeArtifact.type === "document" ? (
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <FileCode2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{displayName}</span>
                      {activeArtifact.type !== "document" && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{displayLang}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {activeArtifact.type !== "document" && (
                        <div className="flex rounded-md border bg-background overflow-hidden mr-1">
                          <button
                            onClick={() => setArtifactViewMode("code")}
                            className={cn("px-2.5 py-1 text-xs", artifactViewMode === "code" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                          >
                            Code
                          </button>
                          <button
                            onClick={() => setArtifactViewMode("preview")}
                            className={cn("px-2.5 py-1 text-xs border-l", artifactViewMode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                          >
                            {activeArtifact.previewUrl ? "▶ Live" : "Preview"}
                          </button>
                        </div>
                      )}
                      {activeArtifact.previewUrl && (
                        <a
                          href={activeArtifact.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline flex items-center gap-1 mr-1"
                        >
                          Open in new tab <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {activeArtifact.previewUrl && (
                        <button
                          disabled={sandboxRestarting}
                          onClick={async () => {
                            setSandboxRestarting(true);
                            setArtifactViewMode("preview");
                            try {
                              const res = await fetch("/api/sandbox/restart", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  snapshotId: activeArtifact.snapshotId ?? undefined,
                                  runCommand: activeArtifact.runCommand ?? "npm start",
                                  exposePort: activeArtifact.exposePort ?? 5173,
                                  files: activeArtifact.files,
                                }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.previewUrl) {
                                  setActiveArtifact((prev) => prev ? { ...prev, previewUrl: data.previewUrl } : prev);
                                }
                              }
                            } catch {
                              // silent
                            } finally {
                              setSandboxRestarting(false);
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors mr-1",
                            sandboxRestarting
                              ? "border-primary bg-primary/10 text-primary animate-pulse"
                              : "border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900"
                          )}
                        >
                          {sandboxRestarting ? (
                            <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Restarting...</>
                          ) : (
                            <><Zap className="h-2.5 w-2.5" /> Restart</>
                          )}
                        </button>
                      )}
                      {activeArtifact.artifactId && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn("h-7 w-7", showVersionHistory && "bg-primary/10 text-primary")}
                          onClick={() => setShowVersionHistory(v => !v)}
                          aria-label="Version history"
                          title="Version history"
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setActiveArtifact(null)} aria-label="Close artifact panel">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {activeArtifact.description && (
                    <div className="px-4 py-1.5 border-b bg-muted/10">
                      <p className="text-xs text-muted-foreground">{activeArtifact.description}</p>
                    </div>
                  )}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Version history sidebar — slides in from right */}
                    {showVersionHistory && activeArtifact.artifactId && (
                      <div className="w-56 shrink-0 border-r overflow-y-auto p-2 bg-muted/10">
                        <ArtifactVersionHistory
                          artifactId={activeArtifact.artifactId}
                          currentVersion={activeArtifact.currentVersion ?? 1}
                          onRestore={() => {
                            // TODO: reload artifact content after restore
                            setShowVersionHistory(false);
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 overflow-auto">
                    {activeArtifact.type === "document" ? (
                      <DocumentArtifactEditor
                        content={displayCode}
                        documentId={activeArtifact.contextId}
                      />
                    ) : (
                      <>
                        {artifactViewMode === "code" && (
                          <CodeBlock code={displayCode} language={displayLang as import("shiki").BundledLanguage} showLineNumbers>
                            <div />
                          </CodeBlock>
                        )}
                        {artifactViewMode === "preview" && (
                          activeArtifact.previewUrl ? (
                            <div className="relative w-full h-full">
                              {/* Loading overlay — shows during restart or initial load */}
                              {sandboxRestarting && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-20">
                                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                                  <p className="text-base font-semibold text-foreground">Restarting sandbox...</p>
                                  <p className="text-sm text-muted-foreground mt-1">Installing packages and building your app</p>
                                  <p className="text-xs text-muted-foreground mt-3">This may take 15-30 seconds</p>
                                </div>
                              )}
                              <div id="preview-loader" className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10 transition-opacity duration-300">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                                <p className="text-sm font-medium text-foreground">Loading preview...</p>
                                <p className="text-xs text-muted-foreground mt-1">Waiting for sandbox to respond</p>
                              </div>
                              <iframe
                                src={activeArtifact.previewUrl}
                                className="w-full h-full bg-white"
                                title={`Preview of ${activeArtifact.filename}`}
                                onLoad={(e) => {
                                  // Hide loader when iframe content loads
                                  const loader = (e.target as HTMLIFrameElement).parentElement?.querySelector("#preview-loader");
                                  if (loader) (loader as HTMLElement).style.opacity = "0";
                                  setTimeout(() => { if (loader) (loader as HTMLElement).style.display = "none"; }, 300);
                                }}
                              />
                            </div>
                          ) : (
                            <iframe
                              srcDoc={(() => {
                                const code = displayCode;
                                const lang = displayLang;
                                if (lang === "html" || code.trim().startsWith("<!DOCTYPE") || code.trim().startsWith("<html")) return code;
                                if (lang === "tsx" || lang === "jsx" || lang === "typescript" || lang === "javascript") {
                                  if (code.includes("React") || code.includes("useState") || code.includes("JSX") || code.includes("<div")) {
                                    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://unpkg.com/react@18/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>body{margin:0;font-family:system-ui,sans-serif}</style></head><body><div id="root"></div><script type="text/babel">${code}\nif(typeof App!=='undefined')ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));</script></body></html>`;
                                  }
                                  return `<!DOCTYPE html><html><head><style>body{margin:0;font-family:monospace;padding:16px;background:#1a1a2e;color:#0f0}</style></head><body><pre id="output"></pre><script>const _log=console.log;const _lines=[];console.log=(...a)=>{_lines.push(a.join(' '));document.getElementById('output').textContent=_lines.join('\\n')};${code}</script></body></html>`;
                                }
                                if (lang === "css") return `<!DOCTYPE html><html><head><style>${code}</style></head><body><p>CSS Preview</p></body></html>`;
                                if (lang === "svg") return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}</style></head><body>${code}</body></html>`;
                                return `<!DOCTYPE html><html><head><style>body{margin:0;font-family:monospace;padding:16px;white-space:pre-wrap;background:#1e1e1e;color:#d4d4d4}</style></head><body>${code.replace(/</g, "&lt;")}</body></html>`;
                              })()}
                              className="w-full h-full bg-white"
                              sandbox="allow-scripts"
                              title={`Preview of ${activeArtifact.filename}`}
                            />
                          )
                        )}
                      </>
                    )}
                  </div>
                  </div>
                </div>
              </>
            );
          })()}
        </aside>
      ) : (
        <>
          {/* Context panel toggle button (visible when panel is hidden, desktop only) */}
          {!contextPanelOpen && (
            <button
              onClick={toggleContextPanel}
              className="hidden lg:flex items-center justify-center w-8 shrink-0 border-l bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Show context panel"
              title="Show context panel"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          )}

          {/* Right: context panel (hidden by default, opens on search results) */}
          {contextPanelOpen && (
            <aside className="hidden lg:flex w-72 shrink-0 border-l flex-col bg-card">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Context Retrieved</p>
                {latestSources.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{latestSources.length} items</span>
                )}
                <button
                  onClick={toggleContextPanel}
                  className="ml-auto inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  aria-label="Hide context panel"
                  title="Hide context panel"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
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
          )}
        </>
      )}
    </div>
  );
}
