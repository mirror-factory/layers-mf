"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Monitor, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Preferences {
  digest_enabled: boolean;
  digest_time: string;
  email_on_mention: boolean;
  email_on_action_item: boolean;
  email_on_new_context: boolean;
  weekly_summary: boolean;
}

const DIGEST_TIMES = [
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
];

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [original, setOriginal] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications");
      if (!res.ok) throw new Error("Failed to load preferences");
      const data: Preferences = await res.json();
      setPrefs(data);
      setOriginal(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const hasChanges =
    prefs && original
      ? JSON.stringify(prefs) !== JSON.stringify(original)
      : false;

  async function handleSave() {
    if (!prefs || !original) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const updates: Partial<Preferences> = {};
      for (const key of Object.keys(prefs) as (keyof Preferences)[]) {
        if (prefs[key] !== original[key]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (updates as any)[key] = prefs[key];
        }
      }

      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }

      setOriginal({ ...prefs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading) {
    return (
      <div role="status" aria-label="Loading notification preferences" className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? "Failed to load preferences"}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="notification-settings">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">
                Desktop Notifications
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get browser push notifications when scheduled tasks complete,
                approvals arrive, or new inbox items appear.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!('Notification' in window)) return;
              if (Notification.permission === 'granted') {
                new Notification('Granger: Notifications enabled', {
                  body: 'You will receive desktop alerts for important events.',
                  icon: '/icon.png',
                });
              } else if (Notification.permission !== 'denied') {
                const result = await Notification.requestPermission();
                if (result === 'granted') {
                  new Notification('Granger: Notifications enabled', {
                    body: 'You will receive desktop alerts for important events.',
                    icon: '/icon.png',
                  });
                }
              }
            }}
          >
            {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
              ? 'Enabled'
              : 'Enable'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Volume2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">
                Notification Sound
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Play a ping sound when new notifications arrive.
              </p>
            </div>
          </div>
          <Switch
            checked={typeof window !== "undefined" && localStorage.getItem("notification-sound") !== "off"}
            onCheckedChange={(v) => {
              localStorage.setItem("notification-sound", v ? "on" : "off");
            }}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="digest_enabled" className="text-sm font-medium">
              Daily Digest
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive a daily summary of activity in your organization.
            </p>
          </div>
          <Switch
            id="digest_enabled"
            checked={prefs.digest_enabled}
            onCheckedChange={(v) => update("digest_enabled", v)}
          />
        </div>

        {prefs.digest_enabled && (
          <div className="flex items-center gap-3 pl-1">
            <Label htmlFor="digest_time" className="text-sm text-muted-foreground">
              Delivery time
            </Label>
            <Select
              value={prefs.digest_time}
              onValueChange={(v) => update("digest_time", v)}
            >
              <SelectTrigger id="digest_time" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIGEST_TIMES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="email_on_mention" className="text-sm font-medium">
              Email on Mentions
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified when someone mentions you.
            </p>
          </div>
          <Switch
            id="email_on_mention"
            checked={prefs.email_on_mention}
            onCheckedChange={(v) => update("email_on_mention", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="email_on_action_item" className="text-sm font-medium">
              Email on Action Items
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified when an action item is assigned to you.
            </p>
          </div>
          <Switch
            id="email_on_action_item"
            checked={prefs.email_on_action_item}
            onCheckedChange={(v) => update("email_on_action_item", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="email_on_new_context" className="text-sm font-medium">
              Email on New Context
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified when new context items are added.
            </p>
          </div>
          <Switch
            id="email_on_new_context"
            checked={prefs.email_on_new_context}
            onCheckedChange={(v) => update("email_on_new_context", v)}
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="weekly_summary" className="text-sm font-medium">
              Weekly Summary
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive a weekly report with key metrics and highlights.
            </p>
          </div>
          <Switch
            id="weekly_summary"
            checked={prefs.weekly_summary}
            onCheckedChange={(v) => update("weekly_summary", v)}
          />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          {saved ? "Saved" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
