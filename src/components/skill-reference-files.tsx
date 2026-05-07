"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ReferenceFileType = "text" | "markdown" | "code";

interface ReferenceFile {
  name: string;
  content: string;
  type: ReferenceFileType;
}

const FILE_TYPE_LABELS: Record<ReferenceFileType, string> = {
  text: "Text",
  markdown: "Markdown",
  code: "Code",
};

export function SkillReferenceFiles({
  skillId,
  initialFiles,
  onUpdate,
}: {
  skillId: string;
  initialFiles: ReferenceFile[];
  onUpdate?: (files: ReferenceFile[]) => void;
}) {
  const [files, setFiles] = useState<ReferenceFile[]>(initialFiles);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // New file form state
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<ReferenceFileType>("text");

  const handleAddFile = () => {
    if (!newName.trim() || !newContent.trim()) return;

    const updated = [
      ...files,
      { name: newName.trim(), content: newContent.trim(), type: newType },
    ];
    setFiles(updated);
    setDirty(true);
    setNewName("");
    setNewContent("");
    setNewType("text");
    setAdding(false);
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceFiles: files }),
      });

      if (res.ok) {
        setDirty(false);
        onUpdate?.(files);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Reference Files</Label>
          <span className="text-xs text-muted-foreground">
            ({files.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              disabled={saving}
              className="h-7 text-xs"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Save
            </Button>
          )}
          {!adding && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding(true)}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add File
            </Button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Reference files are injected into the skill&apos;s context when
        activated. Use them for brand guidelines, templates, code snippets, or
        any reference material.
      </p>

      {/* Existing files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="rounded-md border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {file.name}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        file.type === "code"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : file.type === "markdown"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400"
                      )}
                    >
                      {FILE_TYPE_LABELS[file.type]}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {file.content.length} characters
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <pre className="mt-2 text-xs text-muted-foreground bg-muted rounded p-2 max-h-24 overflow-auto whitespace-pre-wrap">
                {file.content.slice(0, 500)}
                {file.content.length > 500 ? "..." : ""}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Add file form */}
      {adding && (
        <div className="rounded-md border border-dashed p-3 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">
                File Name
              </Label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="brand-guidelines.md"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div className="w-32">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={newType}
                onValueChange={(v) => setNewType(v as ReferenceFileType)}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Content</Label>
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Paste file content here..."
              rows={6}
              className="mt-1 text-sm font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setNewName("");
                setNewContent("");
                setNewType("text");
              }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddFile}
              disabled={!newName.trim() || !newContent.trim()}
              className="h-7 text-xs"
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
