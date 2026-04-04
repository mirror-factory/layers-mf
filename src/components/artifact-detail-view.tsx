"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Code,
  FileText,
  Globe,
  Image as ImageIcon,
  Table2,
  Box,
  MessageSquare,
  Copy,
  Check,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArtifactVersionHistory } from "@/components/artifact-version-history";

interface ArtifactDetailViewProps {
  artifact: {
    id: string;
    title: string;
    type: string;
    language: string | null;
    framework: string | null;
    content: string | null;
    description_short: string | null;
    description_oneliner: string | null;
    tags: string[];
    current_version: number;
    status: string;
    conversation_id: string | null;
    created_at: string;
    updated_at: string;
    preview_url: string | null;
  };
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  code:     { label: "Code",     icon: Code,      color: "text-blue-500" },
  document: { label: "Document", icon: FileText,   color: "text-amber-500" },
  html:     { label: "HTML",     icon: Globe,      color: "text-orange-500" },
  csv:      { label: "CSV",      icon: Table2,     color: "text-green-500" },
  image:    { label: "Image",    icon: ImageIcon,  color: "text-pink-500" },
  sandbox:  { label: "Sandbox",  icon: Box,        color: "text-purple-500" },
};

export function ArtifactDetailView({ artifact }: ArtifactDetailViewProps) {
  const [copied, setCopied] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(artifact.current_version);

  const typeMeta = TYPE_META[artifact.type] ?? {
    label: artifact.type,
    icon: FileText,
    color: "text-muted-foreground",
  };
  const TypeIcon = typeMeta.icon;

  const handleCopy = () => {
    if (!artifact.content) return;
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    if (!artifact.content) {
      return (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No content available for this artifact.
        </div>
      );
    }

    if (artifact.type === "html" && artifact.content.includes("<")) {
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
              srcDoc={artifact.content}
              className="w-full h-[400px] bg-white"
              sandbox="allow-scripts"
              title={artifact.title}
            />
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors py-1">
              View source
            </summary>
            <pre className="mt-1 p-3 rounded-md bg-muted/50 overflow-x-auto text-[11px] font-mono max-h-48 overflow-y-auto">
              {artifact.content}
            </pre>
          </details>
        </div>
      );
    }

    if (artifact.type === "code" || artifact.type === "sandbox") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Code className="h-4 w-4 text-blue-500" />
              {artifact.title}
              {artifact.language && (
                <span className="text-xs text-muted-foreground font-normal">{artifact.language}</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="rounded-lg border bg-muted/30 p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[500px] overflow-y-auto">
            {artifact.content}
          </pre>
        </div>
      );
    }

    // Default: document / csv / text
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TypeIcon className={`h-4 w-4 ${typeMeta.color}`} />
            Content
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="rounded-lg border bg-card p-4 prose prose-sm dark:prose-invert max-w-none max-h-[500px] overflow-y-auto whitespace-pre-wrap">
          {artifact.content}
        </div>
      </div>
    );
  };

  return (
    <div data-testid="artifact-detail-page" className="flex flex-col p-4 sm:p-8 gap-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/context"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Context Library
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1.5">
            <TypeIcon className={`h-3 w-3 ${typeMeta.color}`} />
            {typeMeta.label}
          </Badge>
          {artifact.language && (
            <Badge variant="outline">{artifact.language}</Badge>
          )}
          {artifact.framework && (
            <Badge variant="outline">{artifact.framework}</Badge>
          )}
          <Badge
            variant={artifact.status === "active" ? "default" : artifact.status === "archived" ? "secondary" : "destructive"}
          >
            {artifact.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <h1 data-testid="context-detail-title" className="text-2xl font-semibold">
            {artifact.title}
          </h1>
          <Badge variant="outline" className="text-xs">
            v{currentVersion}
          </Badge>
        </div>

        {artifact.description_short && (
          <p className="text-muted-foreground">{artifact.description_short}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Created{" "}
            {new Date(artifact.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {artifact.updated_at !== artifact.created_at && (
            <span>
              Updated{" "}
              {new Date(artifact.updated_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Tags */}
      {artifact.tags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {artifact.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {renderContent()}

      {/* Open in Chat button */}
      {artifact.conversation_id && (
        <Link href={`/?conversation_id=${artifact.conversation_id}`}>
          <Button variant="outline" className="gap-2 w-fit">
            <MessageSquare className="h-4 w-4" />
            Open in Chat
          </Button>
        </Link>
      )}

      {/* Version History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <ArtifactVersionHistory
            artifactId={artifact.id}
            currentVersion={currentVersion}
            onRestore={(newVersion) => setCurrentVersion(newVersion)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
