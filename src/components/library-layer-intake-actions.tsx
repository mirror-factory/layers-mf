"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, FolderPlus, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type StackOption = {
  id: string;
  name: string;
};

type InboxItem = {
  id: string;
  title: string;
  type: string | null;
  priority: string | null;
  source_type: string | null;
  created_at: string | null;
};

interface LibraryLayerIntakeActionsProps {
  stacks: StackOption[];
  inboxItems: InboxItem[];
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  }
  return payload;
}

export function LibraryLayerIntakeActions({
  stacks,
  inboxItems,
}: LibraryLayerIntakeActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stackName, setStackName] = useState("");
  const [stackDescription, setStackDescription] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemBody, setItemBody] = useState("");
  const [itemType, setItemType] = useState("note");
  const [curationStackId, setCurationStackId] = useState<string>("none");

  const selectedStackIds = useMemo(() => {
    return curationStackId === "none" ? [] : [curationStackId];
  }, [curationStackId]);

  function run(label: string, task: () => Promise<void>) {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        await task();
        setStatus(label);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Action failed");
      }
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-3" aria-label="Library intake actions">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="h-4 w-4" />
            Create Stack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="library-stack-name">Name</Label>
            <Input
              id="library-stack-name"
              value={stackName}
              onChange={(event) => setStackName(event.target.value)}
              placeholder="Customer Research"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="library-stack-description">Description</Label>
            <Textarea
              id="library-stack-description"
              value={stackDescription}
              onChange={(event) => setStackDescription(event.target.value)}
              placeholder="A shelf for decisions, notes, and source material."
              rows={3}
            />
          </div>
          <Button
            className="w-full"
            disabled={isPending || !stackName.trim()}
            onClick={() =>
              run("Stack created", async () => {
                await postJson("/api/library/stacks", {
                  name: stackName,
                  description: stackDescription,
                });
                setStackName("");
                setStackDescription("");
              })
            }
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Create Stack
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Save className="h-4 w-4" />
            Save Item
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="library-item-title">Title</Label>
            <Input
              id="library-item-title"
              value={itemTitle}
              onChange={(event) => setItemTitle(event.target.value)}
              placeholder="Decision note"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="library-item-type">Type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger id="library-item-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
                <SelectItem value="artifact">Artifact</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="library-item-body">Body</Label>
            <Textarea
              id="library-item-body"
              value={itemBody}
              onChange={(event) => setItemBody(event.target.value)}
              placeholder="Paste the source text or summary Dewey should remember."
              rows={4}
            />
          </div>
          <Button
            className="w-full"
            disabled={isPending || !itemTitle.trim()}
            onClick={() =>
              run("Library Item saved", async () => {
                await postJson("/api/library/items", {
                  title: itemTitle,
                  body: itemBody,
                  itemType,
                  sourceType: "manual",
                });
                setItemTitle("");
                setItemBody("");
                setItemType("note");
              })
            }
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save to Library
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4" />
            Inbox Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="library-curation-stack">Destination Stack</Label>
            <Select value={curationStackId} onValueChange={setCurationStackId}>
              <SelectTrigger id="library-curation-stack">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Stack</SelectItem>
                {stacks.map((stack) => (
                  <SelectItem key={stack.id} value={stack.id}>
                    {stack.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {inboxItems.length === 0 ? (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">Inbox is clear.</p>
            ) : (
              inboxItems.map((item) => (
                <div key={item.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.source_type ?? "inbox"} · {item.type ?? "note"}
                      </p>
                    </div>
                    {item.priority && <Badge variant="outline">{item.priority}</Badge>}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      run("Inbox item curated", async () => {
                        await postJson(`/api/library/inbox/${item.id}/curate`, {
                          stackIds: selectedStackIds,
                          itemType: item.type ?? "note",
                        });
                      })
                    }
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save Item
                  </Button>
                </div>
              ))
            )}
          </div>
          {(status || error) && (
            <div className="rounded-md border p-3 text-sm">
              {status && <p className="text-emerald-600 dark:text-emerald-400">{status}</p>}
              {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
