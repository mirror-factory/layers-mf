"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, RefreshCw, RotateCcw, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DittoProfile {
  interests: string[];
  preferred_sources: Record<string, number>;
  communication_style: "formal" | "casual" | "balanced";
  detail_level: "brief" | "moderate" | "detailed";
  priority_topics: string[];
  working_hours: { start: number; end: number };
  confidence: number;
  interaction_count: number;
  last_generated_at: string | null;
}

const DEFAULT_PROFILE: DittoProfile = {
  interests: [],
  preferred_sources: {},
  communication_style: "balanced",
  detail_level: "moderate",
  priority_topics: [],
  working_hours: { start: 9, end: 17 },
  confidence: 0,
  interaction_count: 0,
  last_generated_at: null,
};

export function DittoProfileView() {
  const [profile, setProfile] = useState<DittoProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newInterest, setNewInterest] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/ditto/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handlePatch(updates: Partial<DittoProfile>) {
    setSaving(true);
    try {
      const res = await fetch("/api/ditto/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/ditto/profile/generate", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // silently fail
    } finally {
      setRegenerating(false);
    }
  }

  async function handleReset() {
    await handlePatch({
      interests: [],
      preferred_sources: {},
      communication_style: "balanced",
      detail_level: "moderate",
      priority_topics: [],
      working_hours: { start: 9, end: 17 },
    });
  }

  function removeInterest(interest: string) {
    handlePatch({
      interests: profile.interests.filter((i) => i !== interest),
    });
  }

  function addInterest() {
    const trimmed = newInterest.trim();
    if (!trimmed || profile.interests.includes(trimmed)) return;
    handlePatch({
      interests: [...profile.interests, trimmed],
    });
    setNewInterest("");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Bot className="h-5 w-5 animate-pulse" />
        <span>Loading profile...</span>
      </div>
    );
  }

  const confidencePct = Math.round(profile.confidence * 100);
  const sortedSources = Object.entries(profile.preferred_sources).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div className="space-y-8">
      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>{profile.interaction_count} interactions tracked</span>
        {profile.last_generated_at && (
          <span>
            Last generated:{" "}
            {new Date(profile.last_generated_at).toLocaleDateString()}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", regenerating && "animate-spin")}
            />
            {regenerating ? "Regenerating..." : "Regenerate Profile"}
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Confidence meter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium">Profile Confidence</h2>
          <span className="text-sm text-muted-foreground">{confidencePct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              confidencePct < 30
                ? "bg-red-500"
                : confidencePct < 60
                  ? "bg-yellow-500"
                  : "bg-green-500"
            )}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {confidencePct < 30
            ? "Not enough data yet. Keep using Layers to improve accuracy."
            : confidencePct < 60
              ? "Building a picture. Profile will improve with more interactions."
              : "High confidence. Ditto knows your preferences well."}
        </p>
      </div>

      {/* Interests */}
      <div>
        <h2 className="text-sm font-medium mb-3">Interests</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {profile.interests.length === 0 && (
            <p className="text-sm text-muted-foreground">No interests detected yet.</p>
          )}
          {profile.interests.map((interest) => (
            <span
              key={interest}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
            >
              {interest}
              <button
                onClick={() => removeInterest(interest)}
                className="ml-0.5 hover:text-destructive transition-colors"
                aria-label={`Remove ${interest}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInterest()}
            placeholder="Add interest..."
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <button
            onClick={addInterest}
            disabled={!newInterest.trim()}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Source preferences */}
      <div>
        <h2 className="text-sm font-medium mb-3">Source Preferences</h2>
        {sortedSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No source data yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedSources.map(([source, score]) => (
              <div key={source} className="flex items-center gap-3">
                <span className="text-sm w-28 truncate capitalize">{source}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {Math.round(score * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Communication style */}
      <div>
        <h2 className="text-sm font-medium mb-3">Communication Style</h2>
        <div className="flex gap-2">
          {(["formal", "casual", "balanced"] as const).map((style) => (
            <button
              key={style}
              onClick={() => handlePatch({ communication_style: style })}
              disabled={saving}
              className={cn(
                "rounded-md border px-4 py-2 text-sm capitalize transition-colors",
                profile.communication_style === style
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent"
              )}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Detail level */}
      <div>
        <h2 className="text-sm font-medium mb-3">Detail Level</h2>
        <div className="flex gap-2">
          {(["brief", "moderate", "detailed"] as const).map((level) => (
            <button
              key={level}
              onClick={() => handlePatch({ detail_level: level })}
              disabled={saving}
              className={cn(
                "rounded-md border px-4 py-2 text-sm capitalize transition-colors",
                profile.detail_level === level
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent"
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Working hours */}
      <div>
        <h2 className="text-sm font-medium mb-3">Working Hours</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Start</label>
          <select
            value={profile.working_hours.start}
            onChange={(e) =>
              handlePatch({
                working_hours: {
                  ...profile.working_hours,
                  start: parseInt(e.target.value),
                },
              })
            }
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <label className="text-sm text-muted-foreground">End</label>
          <select
            value={profile.working_hours.end}
            onChange={(e) =>
              handlePatch({
                working_hours: {
                  ...profile.working_hours,
                  end: parseInt(e.target.value),
                },
              })
            }
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Priority topics */}
      <div>
        <h2 className="text-sm font-medium mb-3">Priority Topics</h2>
        <div className="flex flex-wrap gap-2">
          {profile.priority_topics.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No priority topics detected yet.
            </p>
          )}
          {profile.priority_topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-sm"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
