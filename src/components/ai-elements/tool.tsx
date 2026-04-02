"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Loader2,
  AlertCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    data-testid="tool-call"
    className={cn("group not-prose w-full", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusConfig: Record<ToolPart["state"], { icon: ReactNode; color: string; label: string }> = {
  "approval-requested": { icon: <ShieldCheck className="h-3 w-3" />, color: "text-amber-400", label: "Approval needed" },
  "approval-responded": { icon: <CheckCircle2 className="h-3 w-3" />, color: "text-blue-400", label: "Responded" },
  "input-available": { icon: <Loader2 className="h-3 w-3 animate-spin" />, color: "text-primary", label: "Running" },
  "input-streaming": { icon: <CircleDot className="h-3 w-3 animate-pulse" />, color: "text-muted-foreground", label: "Pending" },
  "output-available": { icon: <CheckCircle2 className="h-3 w-3" />, color: "text-primary", label: "Done" },
  "output-denied": { icon: <XCircle className="h-3 w-3" />, color: "text-amber-400", label: "Denied" },
  "output-error": { icon: <AlertCircle className="h-3 w-3" />, color: "text-red-400", label: "Error" },
};

// Friendly tool names
const toolLabels: Record<string, string> = {
  search_context: "Searching knowledge base",
  get_document: "Reading document",
  ask_linear_agent: "Checking Linear",
  ask_gmail_agent: "Searching email",
  ask_notion_agent: "Searching Notion",
  ask_granola_agent: "Checking meetings",
  ask_drive_agent: "Searching Drive",
  list_linear_issues: "Listing issues",
  create_linear_issue: "Creating issue",
  query_granola: "Querying meetings",
  search_gmail: "Searching email",
  draft_email: "Drafting email",
  search_notion: "Searching Notion",
  list_drive_files: "Searching Drive",
  web_search: "Searching the web",
  web_browse: "Reading web page",
  run_code: "Running code",
  run_project: "Building project",
  write_code: "Writing code",
  create_document: "Creating document",
  edit_document: "Editing document",
  review_compliance: "Reviewing compliance",
  schedule_action: "Creating schedule",
  list_approvals: "Checking approvals",
  artifact_list: "Listing artifacts",
  artifact_get: "Loading artifact",
  artifact_version: "Checking versions",
  ingest_github_repo: "Importing repo",
};

export const getStatusBadge = (status: ToolPart["state"]) => {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1", config.color)}>
      {config.icon}
    </span>
  );
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");
  const friendlyName = toolLabels[derivedName] ?? title ?? derivedName;
  const config = statusConfig[state];

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-2 py-1 px-0 text-xs transition-colors hover:text-foreground",
        config.color,
        className,
      )}
      {...props}
    >
      {config.icon}
      <span className="text-muted-foreground">{friendlyName}</span>
      {state === "output-available" && (
        <span className="text-primary">&#10003;</span>
      )}
      {state === "output-error" && (
        <span className="text-red-400">failed</span>
      )}
      <ChevronRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-data-[state=open]:rotate-90 ml-auto" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-top-1 data-[state=closed]:slide-out-to-top-1",
      "space-y-3 py-2 pl-5 text-xs text-muted-foreground",
      className,
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-1.5 overflow-hidden", className)} {...props}>
    <h4 className="font-medium text-muted-foreground/60 text-[10px] uppercase tracking-wider">
      Input
    </h4>
    <div className="rounded-md bg-muted/30 text-[11px]">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  children,
  ...props
}: ToolOutputProps & { children?: ReactNode }) => {
  if (children && isValidElement(children)) {
    return (
      <div className={cn("space-y-1.5 overflow-hidden", className)} {...props}>
        <h4 className="font-medium text-muted-foreground/60 text-[10px] uppercase tracking-wider">
          Result
        </h4>
        {children}
      </div>
    );
  }

  const content = errorText ?? output;
  if (content == null) return null;

  const text =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);

  return (
    <div className={cn("space-y-1.5 overflow-hidden", className)} {...props}>
      <h4 className="font-medium text-muted-foreground/60 text-[10px] uppercase tracking-wider">
        {errorText ? "Error" : "Result"}
      </h4>
      <div className={cn("rounded-md text-[11px]", errorText ? "bg-red-500/10" : "bg-muted/30")}>
        <CodeBlock
          code={text}
          language={errorText ? "log" as never : "json"}
        />
      </div>
    </div>
  );
};
