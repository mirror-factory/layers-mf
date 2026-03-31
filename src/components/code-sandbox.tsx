"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { BundledLanguage } from "shiki";
import { Download, Eye, EyeOff, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
} from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  bash: "Bash",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  yaml: "YAML",
  markdown: "Markdown",
  sql: "SQL",
  go: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  java: "Java",
  shell: "Shell",
  sh: "Shell",
  tsx: "TSX",
  jsx: "JSX",
  xml: "XML",
  toml: "TOML",
  dockerfile: "Dockerfile",
};

const PREVIEWABLE_LANGUAGES = new Set(["html", "css", "svg"]);

const SHIKI_LANGUAGE_MAP: Record<string, BundledLanguage> = {
  typescript: "typescript",
  javascript: "javascript",
  python: "python",
  bash: "bash",
  html: "html",
  css: "css",
  json: "json",
  yaml: "yaml",
  markdown: "markdown",
  sql: "sql",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  java: "java",
  shell: "bash",
  sh: "bash",
  tsx: "tsx",
  jsx: "jsx",
  xml: "xml",
  toml: "toml",
  dockerfile: "dockerfile",
};

interface CodeSandboxProps {
  filename: string;
  language: string;
  code: string;
  description?: string;
  contextId?: string;
  className?: string;
}

type ViewMode = "code" | "preview" | "split";

export function CodeSandbox({
  filename,
  language,
  code,
  description,
  contextId,
  className,
}: CodeSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const shikiLanguage = SHIKI_LANGUAGE_MAP[language] ?? "text";
  const languageLabel = LANGUAGE_LABELS[language] ?? language;
  const canPreview = PREVIEWABLE_LANGUAGES.has(language);

  // Auto-show preview for HTML, default to code for other languages
  const [viewMode, setViewMode] = useState<ViewMode>(canPreview ? "split" : "code");

  const previewContent = useMemo(() => {
    if (!canPreview) return "";
    if (language === "html") return code;
    if (language === "css") {
      return `<!DOCTYPE html><html><head><style>${code}</style></head><body><p>CSS Preview</p></body></html>`;
    }
    if (language === "svg") {
      return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f8f8}</style></head><body>${code}</body></html>`;
    }
    return code;
  }, [code, language, canPreview]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [code, filename]);

  const showCode = viewMode === "code" || viewMode === "split";
  const showPreview = (viewMode === "preview" || viewMode === "split") && canPreview;

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* Header bar with filename + view toggles */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{filename}</span>
          <span className="text-[10px] text-muted-foreground">{languageLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggles */}
          {canPreview && (
            <div className="flex rounded-md border bg-background overflow-hidden mr-2">
              <button
                onClick={() => setViewMode("code")}
                className={cn("px-2 py-1 text-[10px]", viewMode === "code" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                Code
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={cn("px-2 py-1 text-[10px] border-x", viewMode === "split" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                Split
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={cn("px-2 py-1 text-[10px]", viewMode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                Preview
              </button>
            </div>
          )}
          <CodeBlockCopyButton />
          <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={handleDownload} aria-label="Download">
            <Download size={14} />
          </Button>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="px-3 py-1.5 border-b bg-muted/10">
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      )}

      {/* Content area — side by side in split mode */}
      <div className={cn("flex", viewMode === "split" ? "flex-row" : "flex-col")}>
        {/* Code panel */}
        {showCode && (
          <div className={cn("overflow-auto", viewMode === "split" ? "w-1/2 border-r" : "w-full", "max-h-[400px]")}>
            <CodeBlock code={code} language={shikiLanguage as BundledLanguage} showLineNumbers>
              <div /> {/* Empty header since we have our own */}
            </CodeBlock>
          </div>
        )}

        {/* Preview panel */}
        {showPreview && (
          <div className={cn(viewMode === "split" ? "w-1/2" : "w-full")}>
            <iframe
              ref={iframeRef}
              srcDoc={previewContent}
              className="w-full min-h-[300px] bg-white"
              sandbox="allow-scripts"
              title={`Preview of ${filename}`}
            />
          </div>
        )}
      </div>

      {/* Context library reference */}
      {contextId && (
        <div className="px-3 py-1.5 border-t bg-muted/20">
          <span className="text-[10px] text-muted-foreground">
            Saved to Context Library
          </span>
        </div>
      )}
    </div>
  );
}
