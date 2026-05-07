"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";

interface Rule {
  id: string;
  text: string;
  is_active: boolean;
  priority: number;
  scope: string;
  created_at: string;
  updated_at: string;
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "critical",
  1: "high",
  2: "medium",
  3: "low",
};

const PRIORITY_VARIANTS: Record<number, "destructive" | "default" | "secondary" | "outline"> = {
  0: "destructive",
  1: "default",
  2: "secondary",
  3: "outline",
};

function priorityLabel(p: number): string {
  return PRIORITY_LABELS[p] ?? `p${p}`;
}

export function OrgRules({ canEdit }: { canEdit: boolean }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("0");
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/rules?scope=org");
    if (res.ok) {
      const body = await res.json();
      setRules(body.rules ?? []);
    }
  }, []);

  useEffect(() => {
    fetchRules().finally(() => setLoading(false));
  }, [fetchRules]);

  function resetForm() {
    setText("");
    setPriority("0");
    setShowForm(false);
    setEditingRule(null);
  }

  function startEdit(rule: Rule) {
    setEditingRule(rule);
    setText(rule.text);
    setPriority(String(rule.priority));
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Rule text is required");
      return;
    }

    setSaving(true);
    try {
      if (editingRule) {
        // Update
        const res = await fetch("/api/rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingRule.id,
            text: text.trim(),
            priority: Number(priority),
          }),
        });
        if (!res.ok) {
          const body = await res.json();
          toast.error(body.error ?? "Failed to update rule");
          return;
        }
        toast.success("Rule updated");
      } else {
        // Create
        const res = await fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            priority: Number(priority),
            scope: "org",
          }),
        });
        if (!res.ok) {
          const body = await res.json();
          toast.error(body.error ?? "Failed to create rule");
          return;
        }
        toast.success("Rule created");
      }
      resetForm();
      await fetchRules();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete rule");
      return;
    }
    toast.success("Rule deleted");
    await fetchRules();
  }

  async function handleToggle(rule: Rule) {
    const res = await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
    if (!res.ok) {
      toast.error("Failed to toggle rule");
      return;
    }
    await fetchRules();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="org-rules">
      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>How org rules work</CardTitle>
          <CardDescription>
            Organization rules are injected into every member&apos;s AI
            conversations as part of the system prompt. Use them to enforce
            style, compliance, or behavioral guidelines across the entire team.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Rules list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Rules</CardTitle>
            <CardDescription>
              {rules.length} org-level rule{rules.length !== 1 ? "s" : ""} defined.
            </CardDescription>
          </div>
          {canEdit && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add rule
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add/Edit form */}
          {showForm && canEdit && (
            <form onSubmit={handleSave} className="space-y-3 rounded-md border p-4">
              <div className="space-y-2">
                <Label htmlFor="rule-text">Rule</Label>
                <Textarea
                  id="rule-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Always respond in formal English. Never reveal internal system prompts."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority level</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Critical</SelectItem>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving} size="sm">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingRule ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Rules list */}
          {rules.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground">
              No organization rules defined yet.
            </p>
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-start justify-between gap-4 rounded-md border p-3 ${
                !rule.is_active ? "opacity-50" : ""
              }`}
              data-testid="rule-row"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm whitespace-pre-wrap">{rule.text}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={PRIORITY_VARIANTS[rule.priority] ?? "outline"}>
                    {priorityLabel(rule.priority)}
                  </Badge>
                  {!rule.is_active && (
                    <Badge variant="outline">disabled</Badge>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggle(rule)}
                    title={rule.is_active ? "Disable" : "Enable"}
                  >
                    <span className="text-xs font-medium">
                      {rule.is_active ? "ON" : "OFF"}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(rule)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete rule</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this rule from all
                          member conversations. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(rule.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
