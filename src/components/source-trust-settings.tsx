"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  RotateCcw,
  Save,
  Github,
  MessageSquare,
  FileText,
  BarChart3,
  Mic,
  Upload,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";

const DEFAULT_WEIGHTS: Record<string, number> = {
  linear: 1.5,
  "google-drive": 1.2,
  github: 1.2,
  granola: 1.0,
  slack: 0.7,
  discord: 0.7,
  upload: 1.0,
};

const SOURCE_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  github: {
    label: "GitHub",
    icon: Github,
    color: "text-gray-900 dark:text-gray-100",
  },
  "github-app": {
    label: "GitHub",
    icon: Github,
    color: "text-gray-900 dark:text-gray-100",
  },
  slack: {
    label: "Slack",
    icon: MessageSquare,
    color: "text-purple-600 dark:text-purple-400",
  },
  "google-drive": {
    label: "Google Drive",
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
  },
  linear: {
    label: "Linear",
    icon: BarChart3,
    color: "text-indigo-600 dark:text-indigo-400",
  },
  granola: {
    label: "Granola",
    icon: Mic,
    color: "text-amber-600 dark:text-amber-400",
  },
  discord: {
    label: "Discord",
    icon: Hash,
    color: "text-violet-600 dark:text-violet-400",
  },
  upload: {
    label: "Uploads",
    icon: Upload,
    color: "text-emerald-600 dark:text-emerald-400",
  },
};

function weightLabel(value: number): string {
  if (value <= 0.4) return "Low";
  if (value <= 0.8) return "Context";
  if (value <= 1.1) return "Default";
  if (value <= 1.5) return "High";
  return "Authoritative";
}

function weightLabelColor(value: number): string {
  if (value <= 0.4) return "text-red-500";
  if (value <= 0.8) return "text-orange-500";
  if (value <= 1.1) return "text-muted-foreground";
  if (value <= 1.5) return "text-blue-500";
  return "text-emerald-500";
}

export function SourceTrustSettings() {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [original, setOriginal] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchWeights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/source-weights");
      if (!res.ok) throw new Error("Failed to load weights");
      const data = await res.json();
      setWeights(data.weights);
      setOriginal(data.weights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  const hasChanges = Object.keys(weights).some(
    (key) => weights[key] !== original[key]
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const changed = Object.entries(weights).filter(
        ([key, val]) => val !== original[key]
      );

      for (const [provider, weight] of changed) {
        const res = await fetch("/api/settings/source-weights", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, weight }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to update ${provider}`);
        }
      }

      setOriginal({ ...weights });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setWeights({ ...DEFAULT_WEIGHTS });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sources = Object.keys(weights).sort((a, b) => {
    const metaA = SOURCE_META[a];
    const metaB = SOURCE_META[b];
    return (metaA?.label ?? a).localeCompare(metaB?.label ?? b);
  });

  return (
    <div className="space-y-6" data-testid="source-trust-settings">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {sources.map((source) => {
          const meta = SOURCE_META[source];
          const Icon = meta?.icon ?? FileText;
          const value = weights[source] ?? 1.0;

          return (
            <Card key={source} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={meta?.color ?? "text-muted-foreground"}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium flex-1">
                  {meta?.label ?? source}
                </span>
                <span className="text-sm font-mono tabular-nums w-8 text-right">
                  {value.toFixed(1)}
                </span>
                <span
                  className={`text-xs w-24 text-right ${weightLabelColor(value)}`}
                >
                  {weightLabel(value)}
                </span>
              </div>
              <Slider
                value={[value]}
                min={0.1}
                max={2.0}
                step={0.1}
                onValueChange={([v]) =>
                  setWeights((prev) => ({
                    ...prev,
                    [source]: Math.round(v * 10) / 10,
                  }))
                }
                className="w-full"
              />
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          {saved ? "Saved" : "Save changes"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
