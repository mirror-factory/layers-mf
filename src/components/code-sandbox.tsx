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

export function CodeSandbox({
  filename,
  language,
  code,
  description,
  contextId,
  className,
}: CodeSandboxProps) {
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const shikiLanguage = SHIKI_LANGUAGE_MAP[language] ?? "text";
  const languageLabel = LANGUAGE_LABELS[language] ?? language;
  const canPreview = PREVIEWABLE_LANGUAGES.has(language);

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

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* Description bar */}
      {description && (
        <div className="px-3 py-2 border-b bg-muted/30">
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      )}

      {/* Code block with header */}
      <CodeBlock code={code} language={shikiLanguage as BundledLanguage} showLineNumbers>
        <CodeBlockHeader>
          <CodeBlockTitle>
            <FileCode2 className="h-3.5 w-3.5" />
            <CodeBlockFilename>{filename}</CodeBlockFilename>
            <span className="text-[10px] text-muted-foreground/70">{languageLabel}</span>
          </CodeBlockTitle>
          <CodeBlockActions>
            {canPreview && (
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0"
                onClick={() => setShowPreview((p) => !p)}
                aria-label={showPreview ? "Hide preview" : "Show preview"}
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
            )}
            <CodeBlockCopyButton />
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0"
              onClick={handleDownload}
              aria-label="Download file"
            >
              <Download size={14} />
            </Button>
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>

      {/* Preview iframe */}
      {showPreview && canPreview && (
        <div className="border-t">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Preview
            </span>
          </div>
          <iframe
            ref={iframeRef}
            srcDoc={previewContent}
            className="w-full min-h-[200px] bg-white"
            sandbox="allow-scripts"
            title={`Preview of ${filename}`}
          />
        </div>
      )}

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
