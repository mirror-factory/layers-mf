"use client";

import { useState } from "react";
import { Copy, Check, FileText, Code, Mic, GitBranch, MessageSquare, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ContentViewerProps {
  content: string;
  contentType: string;
  sourceType: string;
  title: string;
  itemId: string;
}

export function ContentViewer({ content, contentType, sourceType, title, itemId }: ContentViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detect content rendering mode
  const isCode = contentType === "code" || contentType === "file" ||
    /\.(js|ts|jsx|tsx|py|rb|go|rs|java|css|html|json|yaml|yml|sh|sql|md)$/i.test(title);
  const isHtml = contentType === "html" || title.endsWith(".html");
  const isMeeting = contentType === "meeting_transcript" || sourceType === "granola";
  const isIssue = contentType === "issue" || sourceType === "linear";
  const isMessage = contentType === "message" || sourceType === "slack";

  // Detect language from title extension
  const ext = title.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    js: "javascript", ts: "typescript", jsx: "javascript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    css: "css", html: "html", json: "json", yaml: "yaml", yml: "yaml",
    sh: "bash", sql: "sql", md: "markdown",
  };
  const language = langMap[ext] ?? "plaintext";

  if (isHtml && content.includes("<")) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-orange-500" />
            HTML Preview
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <iframe
            srcDoc={content}
            className="w-full h-[400px] bg-white"
            sandbox="allow-scripts"
            title={title}
          />
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors py-1">
            View source
          </summary>
          <pre className="mt-1 p-3 rounded-md bg-muted/50 overflow-x-auto text-[11px] font-mono max-h-48 overflow-y-auto">
            {content}
          </pre>
        </details>
      </div>
    );
  }

  if (isCode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Code className="h-4 w-4 text-blue-500" />
            {title}
            <span className="text-xs text-muted-foreground font-normal">{language}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="rounded-lg border bg-muted/30 p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[500px] overflow-y-auto">
          {content}
        </pre>
      </div>
    );
  }

  if (isMeeting) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mic className="h-4 w-4 text-orange-500" />
          Meeting Transcript
        </div>
        <div className="rounded-lg border bg-card p-4 prose prose-sm dark:prose-invert max-w-none max-h-[500px] overflow-y-auto">
          {content.split("\n").map((line, i) => {
            const speakerMatch = line.match(/^([A-Z][^:]{1,30}):\s*/);
            if (speakerMatch) {
              return (
                <p key={i} className="mb-2">
                  <strong className="text-primary">{speakerMatch[1]}:</strong>
                  <span className="text-muted-foreground">{line.slice(speakerMatch[0].length)}</span>
                </p>
              );
            }
            return line.trim() ? <p key={i} className="mb-2 text-muted-foreground">{line}</p> : <br key={i} />;
          })}
        </div>
      </div>
    );
  }

  if (isIssue) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4 text-indigo-500" />
          Issue
        </div>
        <div className="rounded-lg border bg-card p-4 prose prose-sm dark:prose-invert max-w-none max-h-[500px] overflow-y-auto whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  if (isMessage) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-purple-500" />
          Message
        </div>
        <div className="rounded-lg border bg-card p-4 text-sm max-h-[500px] overflow-y-auto whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  // Default: document/text viewer
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Content
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="rounded-lg border bg-card p-4 prose prose-sm dark:prose-invert max-w-none max-h-[500px] overflow-y-auto whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
