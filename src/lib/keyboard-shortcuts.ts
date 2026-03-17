import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const SEQUENCE_TIMEOUT = 800; // ms to wait for second key in a sequence

interface ShortcutOptions {
  onToggleShortcutsPanel: () => void;
}

export function useKeyboardShortcuts({ onToggleShortcutsPanel }: ShortcutOptions) {
  const router = useRouter();
  const pendingKey = useRef<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    pendingKey.current = null;
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;

      // Don't trigger when typing in inputs, textareas, or contenteditable
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      // Don't interfere with modifier combos (except the ones we explicitly handle)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // ? (Shift+/) opens shortcuts panel
      if (e.key === "?") {
        e.preventDefault();
        onToggleShortcutsPanel();
        clearPending();
        return;
      }

      // / focuses search (command palette)
      if (e.key === "/" && !e.shiftKey) {
        // Let Cmd+K handler in command-palette.tsx handle its own shortcut.
        // We only handle bare "/" here — but since command palette has its own
        // listener, we skip this to avoid conflicts.
        return;
      }

      // Two-key sequences starting with "g"
      if (e.key === "g" && !e.shiftKey && !pendingKey.current) {
        e.preventDefault();
        pendingKey.current = "g";
        pendingTimer.current = setTimeout(clearPending, SEQUENCE_TIMEOUT);
        return;
      }

      if (pendingKey.current === "g") {
        clearPending();
        const routes: Record<string, string> = {
          h: "/",
          c: "/context",
          s: "/sessions",
          i: "/inbox",
          a: "/analytics",
        };
        const route = routes[e.key];
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        return;
      }

      // Escape — handled natively by dialogs, no extra work needed
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearPending();
    };
  }, [router, onToggleShortcutsPanel, clearPending]);
}
