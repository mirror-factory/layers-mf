"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbulb, Zap, HelpCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AmbientAISuggestion {
  id: string;
  type: "info" | "action" | "question";
  title: string;
  body: string;
  source?: string;
  actions: ("accept" | "dismiss" | "modify")[];
}

export interface AmbientAICardProps {
  suggestion: AmbientAISuggestion;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onModify: (id: string, prompt: string) => void;
  isDark?: boolean;
}

const TYPE_ICONS = {
  info: Lightbulb,
  action: Zap,
  question: HelpCircle,
} as const;

const TYPE_COLORS = {
  info: "text-amber-500",
  action: "text-blue-500",
  question: "text-purple-500",
} as const;

export function AmbientAICard({
  suggestion,
  onAccept,
  onDismiss,
  onModify,
  isDark,
}: AmbientAICardProps) {
  const [showModifyInput, setShowModifyInput] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = TYPE_ICONS[suggestion.type];

  useEffect(() => {
    if (showModifyInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showModifyInput]);

  function handleDismiss() {
    setDismissed(true);
    // Allow the opacity transition to complete before calling the callback
    setTimeout(() => onDismiss(suggestion.id), 300);
  }

  function handleModifySubmit() {
    if (modifyPrompt.trim()) {
      onModify(suggestion.id, modifyPrompt.trim());
      setModifyPrompt("");
      setShowModifyInput(false);
    }
  }

  function handleModifyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleModifySubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowModifyInput(false);
      setModifyPrompt("");
    }
  }

  return (
    <Card
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-300 transition-opacity",
        isDark ? "bg-primary/5" : "bg-primary/10",
        dismissed && "opacity-0"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <Icon
            className={cn("mt-0.5 h-4 w-4 shrink-0", TYPE_COLORS[suggestion.type])}
            aria-label={`${suggestion.type} suggestion`}
          />
          <div className="space-y-1">
            <p className="text-sm font-bold leading-tight">{suggestion.title}</p>
            <p className="text-sm text-muted-foreground">{suggestion.body}</p>
          </div>
        </div>
      </CardHeader>

      {suggestion.source && (
        <CardContent className="pb-3 pt-0">
          <p className="text-xs text-muted-foreground/70">
            Source: {suggestion.source}
          </p>
        </CardContent>
      )}

      <CardFooter className="flex-col items-stretch gap-2 pt-0">
        <div className="flex items-center gap-2">
          {suggestion.actions.includes("accept") && (
            <Button size="sm" onClick={() => onAccept(suggestion.id)}>
              Use this
            </Button>
          )}
          {suggestion.actions.includes("dismiss") && (
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Not now
            </Button>
          )}
          {suggestion.actions.includes("modify") && !showModifyInput && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowModifyInput(true)}
            >
              Tell me more
            </Button>
          )}
        </div>

        {showModifyInput && (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={modifyPrompt}
              onChange={(e) => setModifyPrompt(e.target.value)}
              onKeyDown={handleModifyKeyDown}
              placeholder="Ask a follow-up..."
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleModifySubmit}
              disabled={!modifyPrompt.trim()}
            >
              <Send className="h-3 w-3" />
              Send
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
