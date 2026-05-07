"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExplainerSection {
  title: string;
  content: string;
}

interface PageExplainerProps {
  title: string;
  sections: ExplainerSection[];
  defaultOpen?: boolean;
}

export function PageExplainer({ title, sections, defaultOpen = false }: PageExplainerProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground space-y-3 border-t pt-3">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="font-medium text-foreground mb-1">{section.title}</h4>
              <p>{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
