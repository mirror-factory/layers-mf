"use client";

import { useState, useCallback } from "react";
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
      { keys: ["G", "C"], description: "Go to Chat" },
      { keys: ["G", "L"], description: "Go to Context Library" },
      { keys: ["G", "I"], description: "Go to Inbox" },
      { keys: ["G", "A"], description: "Go to Approvals" },
      { keys: ["G", "S"], description: "Go to Settings" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["?"], description: "Open keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialogs / panels" },
      { keys: ["N"], description: "New conversation (on Chat page)" },
      { keys: ["/"], description: "Focus search (on Context Library)" },
    ],
  },
  {
    title: "Chat",
    shortcuts: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift", "Enter"], description: "New line" },
      { keys: ["/"], description: "Open slash commands" },
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
