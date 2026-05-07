"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  GitBranch,
  Mail,
  BookOpen,
  Mic,
  HardDrive,
  Loader2,
} from "lucide-react";

type ServicePermission = { read: boolean; write: boolean };

type ToolPermissions = Record<string, ServicePermission>;

const SERVICES = [
  {
    key: "linear",
    label: "Linear",
    description: "Issues, projects, and task management",
    icon: GitBranch,
  },
  {
    key: "gmail",
    label: "Gmail",
    description: "Email search and drafting",
    icon: Mail,
  },
  {
    key: "notion",
    label: "Notion",
    description: "Pages and databases",
    icon: BookOpen,
  },
  {
    key: "granola",
    label: "Granola",
    description: "Meeting transcripts and notes",
    icon: Mic,
  },
  {
    key: "drive",
    label: "Google Drive",
    description: "File search and reading",
    icon: HardDrive,
  },
] as const;

const DEFAULT_PERMISSIONS: ToolPermissions = Object.fromEntries(
  SERVICES.map((s) => [s.key, { read: true, write: false }])
);

export function PermissionSettings() {
  const [permissions, setPermissions] =
    useState<ToolPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/settings/permissions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.permissions) {
          setPermissions({ ...DEFAULT_PERMISSIONS, ...data.permissions });
        }
      })
      .catch(() => toast.error("Failed to load permissions"))
      .finally(() => setLoading(false));
  }, []);

  const togglePermission = (
    service: string,
    field: "read" | "write",
    value: boolean
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        [field]: value,
        // If disabling read, also disable write
        ...(field === "read" && !value ? { write: false } : {}),
      },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Permissions saved");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {SERVICES.map(({ key, label, description, icon: Icon }) => {
        const perm = permissions[key] ?? { read: true, write: false };
        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription className="text-sm">
                    {description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${key}-read`}
                    checked={perm.read}
                    onCheckedChange={(v) => togglePermission(key, "read", v)}
                  />
                  <Label htmlFor={`${key}-read`} className="text-sm">
                    Can read
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${key}-write`}
                    checked={perm.write}
                    disabled={!perm.read}
                    onCheckedChange={(v) => togglePermission(key, "write", v)}
                  />
                  <Label
                    htmlFor={`${key}-write`}
                    className="text-sm text-muted-foreground"
                  >
                    Can write (with approval)
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button onClick={handleSave} disabled={!dirty || saving} className="mt-4">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Permissions
      </Button>
    </div>
  );
}
