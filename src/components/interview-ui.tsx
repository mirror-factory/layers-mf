"use client";

import { useState, useCallback } from "react";
import { X, Check, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  label: string;
  type: "choice" | "text" | "multiselect";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

interface InterviewData {
  toolCallId: string;
  title: string;
  description?: string;
  questions: Question[];
}

interface InterviewUIProps {
  interview: InterviewData;
  onSubmit: (toolCallId: string, answers: Record<string, string | string[]>) => void;
  onDismiss: (toolCallId: string) => void;
}

export function InterviewUI({ interview, onSubmit, onDismiss }: InterviewUIProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const setAnswer = useCallback((id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const toggleMultiselect = useCallback((id: string, option: string) => {
    setAnswers((prev) => {
      const current = (prev[id] as string[]) ?? [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [id]: next };
    });
  }, []);

  const allRequiredAnswered = interview.questions.every((q) => {
    if (q.required === false) return true;
    const ans = answers[q.id];
    if (!ans) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    return ans.trim().length > 0;
  });

  const handleSubmit = () => {
    if (!allRequiredAnswered) return;
    onSubmit(interview.toolCallId, answers);
  };

  return (
    <div className="mx-auto max-w-3xl w-full animate-in slide-in-from-bottom-2 duration-200">
      <div className="rounded-lg border bg-card shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{interview.title}</span>
          </div>
          <button
            onClick={() => onDismiss(interview.toolCallId)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        {interview.description && (
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            {interview.description}
          </p>
        )}

        {/* Questions */}
        <div className="p-4 space-y-4">
          {interview.questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <label className="text-sm font-medium">
                {q.label}
                {q.required !== false && (
                  <span className="text-destructive ml-0.5">*</span>
                )}
              </label>

              {q.type === "choice" && q.options && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        answers[q.id] === opt
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "multiselect" && q.options && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const selected = ((answers[q.id] as string[]) ?? []).includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleMultiselect(q.id, opt)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "text" && (
                <input
                  type="text"
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder ?? "Type your answer..."}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && allRequiredAnswered) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(interview.toolCallId)}
          >
            Skip
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!allRequiredAnswered}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
