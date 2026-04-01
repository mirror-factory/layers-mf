"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  GripVertical,
  Power,
  Pencil,
  X,
  Check,
  BookOpen,
  Eye,
  Zap,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

type PriorityDoc = {
  id: string;
  filename: string;
  content: string;
  weight: number;
  is_active?: boolean;
  updated_at: string;
};

type Rule = {
  id: string;
  text: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

/* ─── Priority Documents Section ─── */

function PriorityDocumentsSection() {
  const [docs, setDocs] = useState<PriorityDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/priority-docs");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.docs ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newDocs = [...docs];
    [newDocs[index - 1], newDocs[index]] = [newDocs[index], newDocs[index - 1]];
    // Update weights to reflect new order
    const updated = newDocs.map((d, i) => ({ ...d, weight: (i + 1) * 100 }));
    setDocs(updated);
    // Persist weight changes
    await Promise.all(
      updated.map((d) =>
        fetch("/api/priority-docs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.id, weight: d.weight }),
        })
      )
    );
  };

  const handleMoveDown = async (index: number) => {
    if (index === docs.length - 1) return;
    const newDocs = [...docs];
    [newDocs[index], newDocs[index + 1]] = [newDocs[index + 1], newDocs[index]];
    const updated = newDocs.map((d, i) => ({ ...d, weight: (i + 1) * 100 }));
    setDocs(updated);
    await Promise.all(
      updated.map((d) =>
        fetch("/api/priority-docs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.id, weight: d.weight }),
        })
      )
    );
  };

  const handleToggleActive = async (doc: PriorityDoc) => {
    const newActive = !(doc.is_active ?? true);
    setDocs((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, is_active: newActive } : d))
    );
    await fetch("/api/priority-docs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, is_active: newActive }),
    });
  };

  const startEditing = (doc: PriorityDoc) => {
    setEditingId(doc.id);
    setEditContent(doc.content);
  };

  const saveEdit = async (doc: PriorityDoc) => {
    setSaving(true);
    try {
      await fetch("/api/priority-docs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, content: editContent }),
      });
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, content: editContent } : d))
      );
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this priority document?")) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/priority-docs?id=${id}`, { method: "DELETE" });
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/priority-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: newTitle.trim(),
          content: newContent.trim(),
          weight: (docs.length + 1) * 100,
        }),
      });
      if (res.ok) {
        setAdding(false);
        setNewTitle("");
        setNewContent("");
        fetchDocs();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {docs.length === 0 && !adding && (
        <div className="text-center py-8">
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No priority documents yet. Add documents that should always be in
            Granger&apos;s context.
          </p>
        </div>
      )}

      {docs.map((doc, index) => {
        const isExpanded = expandedId === doc.id;
        const isEditing = editingId === doc.id;
        const isActive = doc.is_active ?? true;

        return (
          <div
            key={doc.id}
            className={cn(
              "rounded-lg border bg-card transition-colors",
              !isActive && "opacity-50"
            )}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <span className="text-xs font-mono text-muted-foreground w-6 text-center shrink-0">
                {index + 1}
              </span>

              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : doc.id)
                }
                className="flex-1 text-left min-w-0"
              >
                <h4 className="text-sm font-medium truncate">
                  {doc.filename}
                </h4>
                {!isExpanded && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {doc.content.slice(0, 100)}
                    {doc.content.length > 100 ? "..." : ""}
                  </p>
                )}
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === docs.length - 1}
                  className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleToggleActive(doc)}
                  className={cn(
                    "p-1 rounded hover:bg-accent transition-colors",
                    isActive
                      ? "text-green-500"
                      : "text-muted-foreground"
                  )}
                  title={isActive ? "Disable" : "Enable"}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => startEditing(doc)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1 rounded hover:bg-accent text-red-500/70 hover:text-red-500"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded view */}
            {isExpanded && !isEditing && (
              <div className="px-4 pb-4 border-t pt-3">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-3 max-h-64 overflow-y-auto">
                  {doc.content}
                </pre>
              </div>
            )}

            {/* Edit view */}
            {isEditing && (
              <div className="px-4 pb-4 border-t pt-3 space-y-3">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[200px] p-3 text-sm font-mono rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(doc)}
                    disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add new document form */}
      {adding ? (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <input
            type="text"
            placeholder="Document title (e.g., brand-guidelines)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <textarea
            placeholder="Document content..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full min-h-[120px] p-3 text-sm font-mono rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => {
                setAdding(false);
                setNewTitle("");
                setNewContent("");
              }}
              className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newTitle.trim() || !newContent.trim()}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Add Document
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-dashed hover:border-primary/50 w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add Document
        </button>
      )}
    </div>
  );
}

/* ─── Rules Section ─── */

function RulesSection() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRuleText, setNewRuleText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleAddRule = async () => {
    if (!newRuleText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newRuleText.trim(),
          priority: rules.length,
        }),
      });
      if (res.ok) {
        setNewRuleText("");
        fetchRules();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: Rule) => {
    const newActive = !rule.is_active;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: newActive } : r))
    );
    await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: newActive }),
    });
  };

  const handleDelete = async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newRules = [...rules];
    [newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]];
    const updated = newRules.map((r, i) => ({ ...r, priority: i }));
    setRules(updated);
    await Promise.all(
      updated.map((r) =>
        fetch("/api/rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: r.id, priority: r.priority }),
        })
      )
    );
  };

  const handleMoveDown = async (index: number) => {
    if (index === rules.length - 1) return;
    const newRules = [...rules];
    [newRules[index], newRules[index + 1]] = [newRules[index + 1], newRules[index]];
    const updated = newRules.map((r, i) => ({ ...r, priority: i }));
    setRules(updated);
    await Promise.all(
      updated.map((r) =>
        fetch("/api/rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: r.id, priority: r.priority }),
        })
      )
    );
  };

  const startEditRule = (rule: Rule) => {
    setEditingId(rule.id);
    setEditText(rule.text);
  };

  const saveEditRule = async (rule: Rule) => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, text: editText.trim() }),
      });
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id ? { ...r, text: editText.trim() } : r
        )
      );
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">
            No rules defined yet. Rules are injected into every Granger conversation.
          </p>
        </div>
      )}

      {rules.map((rule, index) => {
        const isEditing = editingId === rule.id;

        return (
          <div
            key={rule.id}
            className={cn(
              "flex items-start gap-2 rounded-lg border bg-card px-4 py-3 transition-colors",
              !rule.is_active && "opacity-50"
            )}
          >
            <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5 text-center shrink-0">
              {index + 1}
            </span>

            {isEditing ? (
              <div className="flex-1 space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full p-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y min-h-[60px]"
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => saveEditRule(rule)}
                    disabled={saving || !editText.trim()}
                    className="p-1 rounded hover:bg-accent text-green-500 disabled:opacity-50"
                    title="Save"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="flex-1 text-sm min-w-0">{rule.text}</p>
            )}

            {!isEditing && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === rules.length - 1}
                  className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleToggle(rule)}
                  className={cn(
                    "p-1 rounded hover:bg-accent transition-colors",
                    rule.is_active ? "text-green-500" : "text-muted-foreground"
                  )}
                  title={rule.is_active ? "Disable" : "Enable"}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => startEditRule(rule)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1 rounded hover:bg-accent text-red-500/70 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add new rule */}
      <div className="flex items-start gap-2">
        <input
          type="text"
          placeholder='Add a rule (e.g., "Always respond in Spanish")'
          value={newRuleText}
          onChange={(e) => setNewRuleText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAddRule();
            }
          }}
          className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={handleAddRule}
          disabled={saving || !newRuleText.trim()}
          className="shrink-0 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add
        </button>
      </div>

      {/* Examples hint */}
      {rules.length === 0 && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Example rules:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>&bull; Always respond in Spanish</li>
            <li>&bull; Never share budget details externally</li>
            <li>&bull; Use formal tone in all communications</li>
            <li>&bull; Always cite sources when referencing meeting notes</li>
            <li>&bull; Prioritize Linear issues tagged &quot;urgent&quot;</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── Prompt Preview Section ─── */

function PromptPreviewSection() {
  const [preview, setPreview] = useState<{
    systemPromptTokens: number;
    rulesTokens: number;
    rulesCount: number;
    toolsTokens: number;
    mcpServerCount: number;
    totalFixedTokens: number;
    contextWindow: number;
    availableForHistory: number;
    pricing: { input: number; output: number };
  } | null>(null);
  const [docs, setDocs] = useState<{ filename: string; content: string; is_active?: boolean }[]>([]);
  const [rules, setRules] = useState<{ text: string; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/chat/context-stats?modelId=anthropic/claude-sonnet-4.6").then((r) => r.ok ? r.json() : null),
      fetch("/api/priority-docs").then((r) => r.ok ? r.json() : null),
      fetch("/api/rules").then((r) => r.ok ? r.json() : null),
    ]).then(([stats, docsData, rulesData]) => {
      if (stats) setPreview(stats);
      if (docsData?.docs) setDocs(docsData.docs);
      if (rulesData?.rules) setRules(rulesData.rules);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Could not load prompt preview.</p>;
  }

  const activeDocs = docs.filter((d) => d.is_active !== false);
  const activeRules = rules.filter((r) => r.is_active);
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  const sections = [
    {
      label: "Base Instructions",
      tokens: preview.systemPromptTokens,
      color: "bg-blue-500",
      description: "Agent persona, tool descriptions, slash commands, guidelines",
    },
    {
      label: `Priority Documents (${activeDocs.length})`,
      tokens: activeDocs.reduce((sum, d) => sum + estimateTokens(d.content), 0),
      color: "bg-purple-500",
      description: activeDocs.map((d) => d.filename).join(", ") || "None active",
    },
    {
      label: `Rules (${activeRules.length})`,
      tokens: preview.rulesTokens,
      color: "bg-amber-500",
      description: activeRules.length > 0 ? activeRules.map((r) => r.text.slice(0, 40)).join("; ") : "None active",
    },
    {
      label: `Tools (${preview.mcpServerCount} MCP servers)`,
      tokens: preview.toolsTokens,
      color: "bg-green-500",
      description: "Built-in tools + MCP server tools",
    },
  ];

  const totalFixed = sections.reduce((sum, s) => sum + s.tokens, 0);
  const pctUsed = (totalFixed / preview.contextWindow) * 100;
  const costPerMsg = (totalFixed / 1_000_000) * preview.pricing.input + (500 / 1_000_000) * preview.pricing.output;

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            System Prompt Breakdown
          </h3>
          <div className="text-xs text-muted-foreground">
            Claude Sonnet 4.6 (200K context)
          </div>
        </div>

        {/* Visual bar */}
        <div className="h-3 bg-muted rounded-full overflow-hidden flex mb-3">
          {sections.map((s) => (
            <div
              key={s.label}
              className={cn("h-full transition-all", s.color)}
              style={{ width: `${Math.max(0.5, (s.tokens / preview.contextWindow) * 100)}%` }}
              title={`${s.label}: ${formatTokens(s.tokens)}`}
            />
          ))}
        </div>

        {/* Section breakdown */}
        <div className="space-y-2">
          {sections.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", s.color)} />
              <span className="font-medium w-48">{s.label}</span>
              <span className="font-mono text-muted-foreground w-14 text-right">{formatTokens(s.tokens)}</span>
              <span className="text-muted-foreground truncate flex-1">{s.description}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {formatTokens(totalFixed)} fixed ({pctUsed.toFixed(1)}%)
            </span>
            <span>{formatTokens(preview.availableForHistory)} for conversation</span>
          </div>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ~${costPerMsg.toFixed(4)}/msg
          </span>
        </div>
      </div>

      {/* Raw prompt preview */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h4 className="text-sm font-medium">Assembled Prompt (simplified)</h4>
          <p className="text-xs text-muted-foreground">This is approximately what Granger sees at the start of each conversation.</p>
        </div>
        <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-96 overflow-y-auto bg-muted/30">
{`[AGENT_INSTRUCTIONS — ${formatTokens(preview.systemPromptTokens)} tokens]
You are Granger, Mirror Factory's AI chief of staff...
(persona, tools, slash commands, guidelines)

${activeDocs.length > 0 ? activeDocs.map((d, i) => `[PRIORITY DOC #${i + 1}: ${d.filename} — ${formatTokens(estimateTokens(d.content))} tokens]
${d.content.slice(0, 200)}${d.content.length > 200 ? "..." : ""}`).join("\n\n") : "[NO PRIORITY DOCUMENTS]"}

${activeRules.length > 0 ? `[USER RULES — ${formatTokens(preview.rulesTokens)} tokens]
${activeRules.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}` : "[NO RULES]"}

[TOOL DEFINITIONS — ${formatTokens(preview.toolsTokens)} tokens]
(${preview.mcpServerCount} MCP servers + built-in tools)

[Current Date & Time]
Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

--- conversation history follows ---`}
        </pre>
      </div>
    </div>
  );
}

/* ─── Page ─── */

type Tab = "documents" | "rules" | "preview";

export default function PriorityPage() {
  const [tab, setTab] = useState<Tab>("documents");
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">
            Priority Documents & Rules
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Documents and rules that are always loaded into Granger&apos;s system
          prompt. Priority documents provide context, rules define behavior.
        </p>
      </div>

      {/* Guide */}
      <div className="mb-6 rounded-lg border bg-card">
        <button
          onClick={() => setGuideOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
        >
          <span>How Priority Documents & Rules Work</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              guideOpen && "rotate-180"
            )}
          />
        </button>
        {guideOpen && (
          <div className="px-4 pb-4 text-sm text-muted-foreground space-y-4 border-t pt-3">
            <div>
              <h4 className="font-medium text-foreground mb-1">Priority Documents</h4>
              <p>
                Priority documents are <span className="text-foreground font-medium">prepended to every system prompt message</span> &mdash;
                they are the very first thing Granger reads before any conversation. They do <em>not</em> overwrite the base instructions;
                they <span className="text-foreground font-medium">add context on top</span> of them.
              </p>
              <p className="mt-1.5">
                Order matters: document #1 is read first, document #5 is read last.
                Place the most critical context at the top.
              </p>
              <div className="mt-2 rounded-md bg-muted/50 p-3">
                <p className="text-xs font-medium text-foreground mb-1">Example priority documents:</p>
                <ul className="text-xs space-y-0.5">
                  <li>&bull; Team roster with roles and responsibilities</li>
                  <li>&bull; Q2 OKRs and key milestones</li>
                  <li>&bull; Client brief for Project X</li>
                  <li>&bull; Product spec or PRD for the current sprint</li>
                  <li>&bull; Brand voice and style guidelines</li>
                </ul>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">Rules</h4>
              <p>
                Rules are injected as a <span className="text-foreground font-medium">&quot;User Rules&quot; section at the end</span> of
                the system prompt. They are hard constraints &mdash; Granger must follow them in every response.
              </p>
              <div className="mt-2 rounded-md bg-muted/50 p-3">
                <p className="text-xs font-medium text-foreground mb-1">Example rules:</p>
                <ul className="text-xs space-y-0.5">
                  <li>&bull; &quot;Always respond in Spanish&quot;</li>
                  <li>&bull; &quot;Never share financial details externally&quot;</li>
                  <li>&bull; &quot;Use casual, friendly tone&quot;</li>
                  <li>&bull; &quot;Always cite sources when referencing meeting notes&quot;</li>
                  <li>&bull; &quot;Prioritize Linear issues tagged urgent&quot;</li>
                </ul>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">How the prompt is assembled</h4>
              <div className="rounded-md bg-muted/50 p-3 font-mono text-xs space-y-1">
                <p className="text-foreground">[Base instructions]</p>
                <p>&darr;</p>
                <p className="text-foreground">[Priority Doc #1] &rarr; [Priority Doc #2] &rarr; ... &rarr; [Priority Doc #N]</p>
                <p>&darr;</p>
                <p className="text-foreground">[## User Rules]</p>
                <p>&darr;</p>
                <p className="text-foreground">[User Message]</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">Managing</h4>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Reorder documents using the up/down arrows to set priority</li>
                <li>Toggle on/off to temporarily disable without deleting</li>
                <li>Add new documents from scratch or from your context library</li>
                <li>Click the pencil icon to edit a document inline</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(
          [
            { value: "documents" as Tab, label: "Priority Documents" },
            { value: "rules" as Tab, label: "Rules" },
            { value: "preview" as Tab, label: "Preview Prompt" },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "documents" && <PriorityDocumentsSection />}
      {tab === "rules" && <RulesSection />}
      {tab === "preview" && <PromptPreviewSection />}
    </div>
  );
}
