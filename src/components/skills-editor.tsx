"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  Eye,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TiptapEditor } from "@/components/tiptap-editor";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */

interface SkillRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  system_prompt: string | null;
  tools: { name: string; description: string }[];
  reference_files: { name: string; content: string; type: string }[];
  is_builtin: boolean;
  is_active: boolean;
}

type SelectedFile =
  | { kind: "prompt"; skillId: string }
  | { kind: "reference"; skillId: string; index: number };

/* ---------- Helpers ---------- */

/** Convert skill data into a virtual file tree */
function buildSkillTree(skills: SkillRow[]) {
  const byCategory: Record<string, SkillRow[]> = {};
  for (const s of skills) {
    const cat = s.category || "general";
    (byCategory[cat] ??= []).push(s);
  }
  return byCategory;
}

function getFileContent(skill: SkillRow, file: SelectedFile): string {
  if (file.kind === "prompt") {
    return skill.system_prompt ?? "";
  }
  const ref = skill.reference_files?.[file.index];
  return ref?.content ?? "";
}

function getFileName(skill: SkillRow, file: SelectedFile): string {
  if (file.kind === "prompt") return "system-prompt.md";
  const ref = skill.reference_files?.[file.index];
  return ref?.name ?? `reference-${file.index}.md`;
}

/** Convert plain text to simple HTML for TipTap */
function textToHtml(text: string): string {
  if (!text) return "<p></p>";
  // If it already looks like HTML, return as-is
  if (text.trim().startsWith("<")) return text;
  // Convert line breaks to paragraphs
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Strip HTML tags to get plain text */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/* ---------- Component ---------- */

export function SkillsEditor() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<SkillRow | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const [treeCollapsed, setTreeCollapsed] = useState(false);

  // AI-assisted editing
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);

  /* Fetch skills */
  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  /* Tree toggle helpers */
  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /* Select a file */
  const handleSelectFile = useCallback(
    (skill: SkillRow, file: SelectedFile) => {
      setSelectedSkill(skill);
      setSelectedFile(file);
      setEditorContent(textToHtml(getFileContent(skill, file)));
      setEditMode(false);
      setSaveStatus("idle");
    },
    [],
  );

  /* Save changes back to skills table */
  const handleSave = useCallback(async () => {
    if (!selectedSkill || !selectedFile) return;
    setSaving(true);
    setSaveStatus("idle");

    const plainText = htmlToText(editorContent);
    const body: Record<string, unknown> = {};

    if (selectedFile.kind === "prompt") {
      body.systemPrompt = plainText;
    } else {
      // Update the specific reference file
      const refs = [...(selectedSkill.reference_files ?? [])];
      if (refs[selectedFile.index]) {
        refs[selectedFile.index] = { ...refs[selectedFile.index], content: plainText };
      }
      body.referenceFiles = refs;
    }

    try {
      const res = await fetch(`/api/skills/${selectedSkill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Save failed");

      // Update local state
      setSkills((prev) =>
        prev.map((s) => {
          if (s.id !== selectedSkill.id) return s;
          if (selectedFile.kind === "prompt") {
            return { ...s, system_prompt: plainText };
          }
          const refs = [...(s.reference_files ?? [])];
          if (refs[selectedFile.index]) {
            refs[selectedFile.index] = { ...refs[selectedFile.index], content: plainText };
          }
          return { ...s, reference_files: refs };
        }),
      );
      setSelectedSkill((prev) => {
        if (!prev) return prev;
        if (selectedFile.kind === "prompt") {
          return { ...prev, system_prompt: plainText };
        }
        const refs = [...(prev.reference_files ?? [])];
        if (refs[selectedFile.index]) {
          refs[selectedFile.index] = { ...refs[selectedFile.index], content: plainText };
        }
        return { ...prev, reference_files: refs };
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [selectedSkill, selectedFile, editorContent]);

  /* AI-assisted editing: describe changes, AI modifies content */
  const handleAiEdit = useCallback(async () => {
    if (!aiEditPrompt.trim() || !selectedSkill || !selectedFile) return;

    setAiEditLoading(true);
    const currentText = htmlToText(editorContent);

    try {
      const res = await fetch("/api/documents/inline-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText: currentText,
          prompt: aiEditPrompt.trim(),
          fullContext: `This is a ${selectedFile.kind === "prompt" ? "system prompt" : "reference file"} for the skill "${selectedSkill.name}": ${selectedSkill.description}`,
        }),
      });

      if (!res.ok) throw new Error("AI edit failed");

      const { replacement } = await res.json();
      setEditorContent(textToHtml(replacement));
      setAiEditPrompt("");
    } catch {
      // silent
    } finally {
      setAiEditLoading(false);
    }
  }, [aiEditPrompt, editorContent, selectedSkill, selectedFile]);

  const tree = buildSkillTree(skills);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-lg border bg-card overflow-hidden">
      {/* Left panel: File tree (collapsible) */}
      <aside
        className={cn(
          "shrink-0 border-r flex flex-col bg-muted/20 transition-all duration-200",
          treeCollapsed ? "w-10" : "w-60",
        )}
      >
        <div className={cn("flex items-center border-b", treeCollapsed ? "justify-center py-2.5" : "px-3 py-2.5")}>
          {!treeCollapsed && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-1">
              Skills Files
            </p>
          )}
          <button
            onClick={() => setTreeCollapsed((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            title={treeCollapsed ? "Expand file tree" : "Collapse file tree"}
          >
            {treeCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {!treeCollapsed && (
          <div className="flex-1 overflow-y-auto py-1">
            {Object.entries(tree).map(([category, catSkills]) => (
              <div key={category}>
                {/* Category folder */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 transition-transform",
                      expandedCategories.has(category) && "rotate-90",
                    )}
                  />
                  {expandedCategories.has(category) ? (
                    <FolderOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Folder className="h-3.5 w-3.5" />
                  )}
                  <span className="capitalize">{category}</span>
                  <span className="ml-auto text-[10px] opacity-60">
                    {catSkills.length}
                  </span>
                </button>

                {/* Skills in this category */}
                {expandedCategories.has(category) &&
                  catSkills.map((skill) => (
                    <div key={skill.id} className="pl-4">
                      {/* Skill folder */}
                      <button
                        onClick={() => toggleSkill(skill.id)}
                        className="flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent/50 transition-colors"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform",
                            expandedSkills.has(skill.id) && "rotate-90",
                          )}
                        />
                        <span className="shrink-0">{skill.icon}</span>
                        <span className="truncate">{skill.name}</span>
                      </button>

                      {/* Skill files */}
                      {expandedSkills.has(skill.id) && (
                        <div className="pl-6">
                          {/* System prompt */}
                          <button
                            onClick={() =>
                              handleSelectFile(skill, {
                                kind: "prompt",
                                skillId: skill.id,
                              })
                            }
                            className={cn(
                              "flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent/50 transition-colors rounded-sm",
                              selectedFile?.kind === "prompt" &&
                                selectedSkill?.id === skill.id &&
                                "bg-accent text-accent-foreground",
                            )}
                          >
                            <FileText className="h-3 w-3 text-primary/70" />
                            <span className="truncate">system-prompt.md</span>
                          </button>

                          {/* Reference files */}
                          {(skill.reference_files ?? []).map((ref, idx) => (
                            <button
                              key={idx}
                              onClick={() =>
                                handleSelectFile(skill, {
                                  kind: "reference",
                                  skillId: skill.id,
                                  index: idx,
                                })
                              }
                              className={cn(
                                "flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent/50 transition-colors rounded-sm",
                                selectedFile?.kind === "reference" &&
                                  selectedSkill?.id === skill.id &&
                                  (selectedFile as { index: number }).index === idx &&
                                  "bg-accent text-accent-foreground",
                              )}
                            >
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">{ref.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ))}

            {skills.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6 px-3">
                No skills installed. Install skills from the Browse tab.
              </p>
            )}
          </div>
        )}
      </aside>

      {/* Right panel: Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedSkill && selectedFile ? (
          <>
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">{selectedSkill.icon}</span>
                <span className="text-sm font-medium truncate">
                  {selectedSkill.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  / {getFileName(selectedSkill, selectedFile)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {saveStatus === "saved" && (
                  <span className="text-[10px] text-emerald-500">Saved</span>
                )}
                {saveStatus === "error" && (
                  <span className="text-[10px] text-destructive">Save failed</span>
                )}
                {editMode ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditMode(false);
                        // Reset to original
                        setEditorContent(
                          textToHtml(getFileContent(selectedSkill, selectedFile)),
                        );
                      }}
                      className="h-7 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      className="h-7 text-xs"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1" />
                      )}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditMode(true)}
                    className="h-7 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* AI edit bar (visible in edit mode) */}
            {editMode && (
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <input
                  type="text"
                  value={aiEditPrompt}
                  onChange={(e) => setAiEditPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAiEdit();
                  }}
                  placeholder="Describe changes... (e.g., make tone more professional)"
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground/60"
                  disabled={aiEditLoading}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleAiEdit}
                  disabled={aiEditLoading || !aiEditPrompt.trim()}
                  className="h-7 text-xs shrink-0"
                >
                  {aiEditLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Apply
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 overflow-y-auto">
              <TiptapEditor
                content={editorContent}
                onChange={setEditorContent}
                editable={editMode}
                placeholder={
                  selectedFile.kind === "prompt"
                    ? "Write a system prompt for this skill..."
                    : "Reference file content..."
                }
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a skill file to view or edit
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Expand a category and skill in the tree to see its files
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
