"use client";

import { useState, useCallback } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Cmd", "K"], description: "Open command palette" },
      { keys: ["G", "H"], description: "Go to Home" },
      { keys: ["G", "C"], description: "Go to Context Library" },
      { keys: ["G", "S"], description: "Go to Sessions" },
      { keys: ["G", "I"], description: "Go to Inbox" },
      { keys: ["G", "A"], description: "Go to Analytics" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["?"], description: "Open keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialogs / panels" },
    ],
  },
  {
    title: "Chat",
    shortcuts: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift", "Enter"], description: "New line" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useKeyboardShortcuts({ onToggleShortcutsPanel: handleToggle });

  return (
    <>
      {/* Floating ? button */}
      <button
        onClick={handleToggle}
        className="fixed bottom-4 right-4 z-40 flex h-8 w-8 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Navigate quickly with these shortcuts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h3>
                <ul className="space-y-1.5">
                  {group.shortcuts.map((shortcut) => (
                    <li
                      key={shortcut.description}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{shortcut.description}</span>
                      <span className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-0.5">
                            {i > 0 && (
                              <span className="mx-0.5 text-xs text-muted-foreground">
                                +
                              </span>
                            )}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
