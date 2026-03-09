"use client";

import {
  FileText,
  Mic,
  GitBranch,
  MessageSquare,
  HardDrive,
  Upload,
  Hash,
  Github,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  "google-drive": { icon: HardDrive, color: "text-blue-500", label: "Drive" },
  gdrive: { icon: HardDrive, color: "text-blue-500", label: "Drive" },
  github: { icon: Github, color: "text-gray-600 dark:text-gray-400", label: "GitHub" },
  "github-app": { icon: Github, color: "text-gray-600 dark:text-gray-400", label: "GitHub" },
  linear: { icon: GitBranch, color: "text-violet-500", label: "Linear" },
  discord: { icon: MessageSquare, color: "text-indigo-500", label: "Discord" },
  slack: { icon: Hash, color: "text-green-600", label: "Slack" },
  granola: { icon: Mic, color: "text-amber-500", label: "Granola" },
  upload: { icon: Upload, color: "text-muted-foreground", label: "Upload" },
};

const CONTENT_CONFIG: Record<string, { icon: React.ElementType }> = {
  meeting_transcript: { icon: Mic },
  document: { icon: FileText },
  issue: { icon: GitBranch },
  message: { icon: MessageSquare },
  file: { icon: FileText },
};

interface SourceBadgeProps {
  sourceType: string;
  contentType?: string;
  className?: string;
}

export function SourceBadge({ sourceType, className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[sourceType] ?? { icon: FileText, color: "text-muted-foreground", label: sourceType };
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className="text-[10px] text-muted-foreground">{config.label}</span>
    </span>
  );
}

export function ContentIcon({ contentType, className }: { contentType: string; className?: string }) {
  const config = CONTENT_CONFIG[contentType] ?? { icon: FileText };
  const Icon = config.icon;
  return <Icon className={cn("h-3 w-3 text-muted-foreground", className)} />;
}

export function getSourceLabel(sourceType: string): string {
  return SOURCE_CONFIG[sourceType]?.label ?? sourceType;
}
