"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Code,
  Quote,
  Highlighter,
  Pencil,
  Eye,
  Save,
  Loader2,
  Undo,
  Redo,
  Minus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentEditorProps {
  content: string;
  itemId: string;
  onSaved?: () => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
              disabled && "opacity-40 pointer-events-none",
            )}
            aria-label={title}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

export function DocumentEditor({ content, itemId, onSaved }: DocumentEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Highlight,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: contentToHtml(content),
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
    },
  });

  const toggleEdit = useCallback(() => {
    if (!editor) return;
    const next = !isEditing;
    setIsEditing(next);
    editor.setEditable(next);
    if (next) {
      editor.commands.focus("end");
    }
  }, [editor, isEditing]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    setSaveMessage(null);

    // Get text content (strip HTML for raw_content storage)
    const text = editor.getText();

    try {
      const res = await fetch(`/api/context/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_content: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to save" }));
        throw new Error(data.error ?? "Failed to save");
      }

      setSaveMessage({ text: "Saved", ok: true });
      setIsEditing(false);
      editor.setEditable(false);
      onSaved?.();
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage({
        text: err instanceof Error ? err.message : "Failed to save",
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  }, [editor, itemId, onSaved]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 overflow-x-auto">
        {/* Mode toggle */}
        <Button
          variant={isEditing ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs mr-2"
          onClick={toggleEdit}
        >
          {isEditing ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </>
          )}
        </Button>

        {isEditing && (
          <>
            {/* Undo / Redo */}
            <ToolbarButton
              title="Undo"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            >
              <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Redo"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            >
              <Redo className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* Text formatting */}
            <ToolbarButton
              title="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Highlight"
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              active={editor.isActive("highlight")}
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Inline Code"
              onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive("code")}
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* Headings */}
            <ToolbarButton
              title="Heading 1"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive("heading", { level: 1 })}
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 2"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive("heading", { level: 2 })}
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 3"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive("heading", { level: 3 })}
            >
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* Lists */}
            <ToolbarButton
              title="Bullet List"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Numbered List"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Task List"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              active={editor.isActive("taskList")}
            >
              <ListChecks className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* Block elements */}
            <ToolbarButton
              title="Blockquote"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              title="Horizontal Rule"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>

            {/* Save */}
            <div className="ml-auto flex items-center gap-2">
              {saveMessage && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    saveMessage.ok ? "text-green-600" : "text-destructive",
                  )}
                >
                  {saveMessage.text}
                </span>
              )}
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Convert plain text / markdown-like content to basic HTML for TipTap.
 * Does minimal conversion — headings, paragraphs, and preserves line breaks.
 */
function contentToHtml(text: string): string {
  if (!text) return "<p></p>";

  // If it already looks like HTML, use as-is
  if (text.trim().startsWith("<")) return text;

  const lines = text.split("\n");
  const htmlLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
    }
    // List items
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) { htmlLines.push("<ul>"); inList = true; }
      htmlLines.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
    }
    // Empty line
    else if (trimmed === "") {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      // skip empty
    }
    // Regular paragraph
    else {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
  }

  if (inList) htmlLines.push("</ul>");

  return htmlLines.join("") || "<p></p>";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
