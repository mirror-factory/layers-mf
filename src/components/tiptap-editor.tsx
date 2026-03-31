"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold,
  Italic,
  Code,
  Sparkles,
  Loader2,
  X,
  Send,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  content: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  documentId?: string;
  placeholder?: string;
  className?: string;
}

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  documentId,
  placeholder = "Start writing...",
  className,
}: TiptapEditorProps) {
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {
          HTMLAttributes: { class: "rounded-md bg-muted p-4 font-mono text-sm" },
        },
      }),
      Placeholder.configure({ placeholder }),
      Highlight.configure({ multicolor: false }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3",
          "prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
          "prose-p:leading-relaxed prose-li:leading-relaxed",
          "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs",
          "prose-pre:bg-muted prose-pre:rounded-md prose-pre:p-4",
          "prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic",
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange?.(html);

      // Auto-save with debounce when documentId is provided
      if (documentId) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          autoSave(documentId, html);
        }, 3000);
      }
    },
  });

  // Sync content prop changes (external updates)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Sync editable prop
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Focus AI input when opened
  useEffect(() => {
    if (aiPromptOpen) {
      setTimeout(() => aiInputRef.current?.focus(), 50);
    }
  }, [aiPromptOpen]);

  const autoSave = useCallback(async (docId: string, html: string) => {
    try {
      await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: html }),
      });
    } catch {
      // silent — auto-save should not interrupt the user
    }
  }, []);

  const handleAiEdit = useCallback(async () => {
    if (!editor || !aiPrompt.trim()) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");

    if (!selectedText.trim()) {
      setAiError("Select some text first");
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch("/api/documents/inline-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          prompt: aiPrompt.trim(),
          fullContext: editor.getText().slice(0, 2000),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "AI edit failed");
      }

      const { replacement } = await res.json();

      // Replace the selection with AI-generated text
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, replacement)
        .run();

      setAiPrompt("");
      setAiPromptOpen(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI edit failed");
    } finally {
      setAiLoading(false);
    }
  }, [editor, aiPrompt]);

  if (!editor) return null;

  return (
    <div className={cn("relative", className)}>
      {/* Bubble menu on text selection */}
      {editor && editable && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
        >
          <BubbleButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Code"
          >
            <Code className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            <Quote className="h-3.5 w-3.5" />
          </BubbleButton>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-0.5" />

          {/* AI Edit button */}
          <BubbleButton
            active={aiPromptOpen}
            onClick={() => {
              setAiPromptOpen(!aiPromptOpen);
              setAiError(null);
            }}
            title="AI Edit"
            className="text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </BubbleButton>
        </BubbleMenu>
      )}

      {/* AI inline prompt (floating above selection) */}
      {aiPromptOpen && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-start justify-center pt-20 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-lg border bg-popover p-3 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">AI Edit</span>
              <button
                onClick={() => {
                  setAiPromptOpen(false);
                  setAiError(null);
                }}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                ref={aiInputRef}
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAiEdit();
                  }
                  if (e.key === "Escape") {
                    setAiPromptOpen(false);
                    setAiError(null);
                  }
                }}
                placeholder="e.g., make more concise, fix grammar, translate..."
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={aiLoading}
              />
              <button
                onClick={handleAiEdit}
                disabled={aiLoading || !aiPrompt.trim()}
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            {aiError && (
              <p className="text-xs text-destructive mt-1.5">{aiError}</p>
            )}
          </div>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Small toggle button for the bubble menu */
function BubbleButton({
  children,
  active,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
