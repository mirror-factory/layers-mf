"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Library,
  Puzzle,
  Loader2,
  Share2,
  ExternalLink,
  Trash2,
  Search,
  Eye,
  Pencil,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Types ---

type SharedConversation = {
  shareId: string;
  type: "conversation";
  itemId: string;
  title: string;
  sharedBy: string;
  sharedById: string;
  sharedDate: string;
  accessLevel: string;
  isOwner: boolean;
};

type SharedContext = {
  type: "context";
  itemId: string;
  title: string;
  sourceType: string;
  contentType: string | null;
  sharedDate: string;
  sharedBy: string;
  accessLevel: string;
};

type SharedSkill = {
  type: "skill";
  itemId: string;
  title: string;
  slug: string;
  description: string;
  author: string;
  category: string;
  sharedDate: string;
  accessLevel: string;
};

type SharingData = {
  conversations: SharedConversation[];
  context: SharedContext[];
  skills: SharedSkill[];
};

// --- Source type display helpers ---

const SOURCE_TYPE_LABELS: Record<string, string> = {
  "google-drive": "Google Drive",
  github: "GitHub",
  slack: "Slack",
  upload: "Upload",
  granola: "Granola",
  linear: "Linear",
};

function formatSourceType(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

// --- Components ---

function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ConversationsList({
  conversations,
  onUnshare,
}: {
  conversations: SharedConversation[];
  onUnshare: (itemId: string) => void;
}) {
  if (conversations.length === 0) {
    return <EmptyState icon={MessageSquare} message="No shared conversations yet. Share a conversation from the chat view." />;
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <div
          key={conv.shareId}
          className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{conv.title}</p>
              <p className="text-xs text-muted-foreground">
                {conv.isOwner ? "Shared by you" : `Shared by ${conv.sharedBy}`}
                {" \u00b7 "}
                {formatRelativeDate(conv.sharedDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] gap-1">
              {conv.accessLevel === "edit" ? (
                <><Pencil className="h-2.5 w-2.5" /> Edit</>
              ) : (
                <><Eye className="h-2.5 w-2.5" /> View</>
              )}
            </Badge>
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href={`/chat?id=${conv.itemId}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {conv.isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onUnshare(conv.itemId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContextList({
  items,
  sourceFilter,
  onSourceFilterChange,
}: {
  items: SharedContext[];
  sourceFilter: string;
  onSourceFilterChange: (v: string) => void;
}) {
  const sourceTypes = [...new Set(items.map((i) => i.sourceType))];
  const filtered = sourceFilter
    ? items.filter((i) => i.sourceType === sourceFilter)
    : items;

  return (
    <div className="space-y-4">
      {/* Source type filter */}
      {sourceTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onSourceFilterChange("")}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full border transition-colors",
              !sourceFilter
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            All
          </button>
          {sourceTypes.map((st) => (
            <button
              key={st}
              onClick={() => onSourceFilterChange(st)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full border transition-colors",
                sourceFilter === st
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {formatSourceType(st)}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Library} message="No shared context items found." />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.itemId}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Library className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeDate(item.sharedDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-[10px]">
                  {formatSourceType(item.sourceType)}
                </Badge>
                <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                  <Link href="/context">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillsList({ skills }: { skills: SharedSkill[] }) {
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleUse = async (skillId: string) => {
    setActivatingId(skillId);
    try {
      await fetch("/api/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: skillId, is_active: true }),
      });
    } catch {
      // silent
    } finally {
      setActivatingId(null);
    }
  };

  if (skills.length === 0) {
    return <EmptyState icon={Puzzle} message="No shared skills yet. Create skills in the Skills page." />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {skills.map((skill) => (
        <div
          key={skill.itemId}
          className="flex flex-col gap-2 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{skill.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {skill.description}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {skill.category}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              by {skill.author}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleUse(skill.itemId)}
              disabled={activatingId === skill.itemId}
            >
              {activatingId === skill.itemId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Use"
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Page ---

export default function SharingPage() {
  const [data, setData] = useState<SharingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/sharing");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUnshare = async (itemId: string) => {
    try {
      const res = await fetch("/api/sharing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "conversation", itemId }),
      });
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                conversations: prev.conversations.filter((c) => c.itemId !== itemId),
              }
            : prev
        );
      }
    } catch {
      // silent
    }
  };

  // Filter by search query
  const filteredConversations = (data?.conversations ?? []).filter(
    (c) => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredContext = (data?.context ?? []).filter(
    (c) => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredSkills = (data?.skills ?? []).filter(
    (s) =>
      !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-4 sm:gap-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Sharing</h1>
          <p className="text-muted-foreground text-sm">
            Conversations, context, and skills shared across your team.
          </p>
        </div>
      </div>

      {/* Guide */}
      <div className="rounded-lg border bg-card">
        <button
          onClick={() => setGuideOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
        >
          <span>How Sharing Works</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              guideOpen && "rotate-180"
            )}
          />
        </button>
        {guideOpen && (
          <div className="px-4 pb-4 text-sm text-muted-foreground space-y-3 border-t pt-3">
            <div>
              <h4 className="font-medium text-foreground mb-1">Share with your team</h4>
              <p>
                Share conversations, context items, and skills with your team.
                Everything shared here is visible to all members of your organization.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">Conversations</h4>
              <p>
                Team members can view shared conversations and continue collaborating.
                The owner controls sharing access and can revoke it at any time.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">Context & Skills</h4>
              <p>
                Context items are automatically shared across the org. Skills shared here
                can be activated by any team member from this page.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search shared items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="conversations">
          <TabsList>
            <TabsTrigger value="conversations" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Conversations
              {filteredConversations.length > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {filteredConversations.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="context" className="gap-1.5">
              <Library className="h-3.5 w-3.5" />
              Context
              {filteredContext.length > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {filteredContext.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-1.5">
              <Puzzle className="h-3.5 w-3.5" />
              Skills
              {filteredSkills.length > 0 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {filteredSkills.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversations">
            <ConversationsList
              conversations={filteredConversations}
              onUnshare={handleUnshare}
            />
          </TabsContent>

          <TabsContent value="context">
            <ContextList
              items={filteredContext}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
            />
          </TabsContent>

          <TabsContent value="skills">
            <SkillsList skills={filteredSkills} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
