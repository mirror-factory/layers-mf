"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { X, Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContextAnnotationsProps {
  itemId: string;
  userTitle: string | null;
  userNotes: string | null;
  userTags: string[];
  trustWeight: number;
  aiTitle?: string;
}

const TRUST_OPTIONS = [
  { value: "0.5", label: "Low (0.5)" },
  { value: "1", label: "Default (1.0)" },
  { value: "1.5", label: "High (1.5)" },
  { value: "2", label: "Authoritative (2.0)" },
] as const;

function trustLabel(weight: number): string {
  if (weight <= 0.5) return "0.5";
  if (weight <= 1) return "1";
  if (weight <= 1.5) return "1.5";
  return "2";
}

export function ContextAnnotations({
  itemId,
  userTitle: initialTitle,
  userNotes: initialNotes,
  userTags: initialTags,
  trustWeight: initialWeight,
  aiTitle,
}: ContextAnnotationsProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [weight, setWeight] = useState(trustLabel(initialWeight));
  const [saving, setSaving] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || tags.includes(tag) || tags.length >= 20 || tag.length > 50) return;
    setTags((prev) => [...prev, tag]);
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag();
      }
    },
    [addTag],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        user_title: title.trim() || null,
        user_notes: notes.trim() || null,
        user_tags: tags,
        trust_weight: parseFloat(weight),
      };

      const res = await fetch(`/api/context/${itemId}/annotations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Annotations saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save annotations");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card data-testid="context-annotations">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          Your Annotations
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Add your own notes and tags without affecting the AI-extracted data.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* User Title */}
        <div className="space-y-1.5">
          <Label htmlFor="user-title" className="text-xs font-medium">
            Custom Title
            {title.trim() && (
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                Custom
              </Badge>
            )}
          </Label>
          <Input
            id="user-title"
            data-testid="annotation-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={aiTitle || "Add a custom title..."}
            maxLength={200}
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground">
            {title.length}/200 characters
          </p>
        </div>

        {/* User Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="user-notes" className="text-xs font-medium">
            Notes
          </Label>
          <Textarea
            id="user-notes"
            data-testid="annotation-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note..."
            maxLength={2000}
            rows={3}
            className="resize-none text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            {notes.length}/2000 characters
          </p>
        </div>

        {/* User Tags */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Tags ({tags.length}/20)
          </Label>
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="gap-1 text-xs font-normal pr-1"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-foreground rounded-full"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              ref={tagInputRef}
              data-testid="annotation-tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type a tag and press Enter..."
              maxLength={50}
              className="h-8 text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={addTag}
              disabled={!tagInput.trim() || tags.length >= 20}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Trust Weight */}
        <div className="space-y-1.5">
          <Label htmlFor="trust-weight" className="text-xs font-medium">
            Trust Weight
          </Label>
          <Select value={weight} onValueChange={setWeight}>
            <SelectTrigger
              id="trust-weight"
              data-testid="annotation-trust-weight"
              className="h-9 w-[200px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRUST_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Higher weight makes this item more influential in AI responses.
          </p>
        </div>

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button
            data-testid="annotation-save"
            onClick={handleSave}
            disabled={saving}
            size="sm"
          >
            {saving ? "Saving..." : "Save Annotations"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
