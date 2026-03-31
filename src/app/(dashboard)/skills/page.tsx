"use client";

import { useCallback, useEffect, useState } from "react";
import { SkillCard } from "@/components/skill-card";
import { SkillCreator } from "@/components/skill-creator";
import { BUILTIN_SKILLS } from "@/lib/skills/types";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2, Puzzle } from "lucide-react";

type SkillRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string | null;
  category: string;
  icon: string;
  slash_command: string | null;
  is_active: boolean;
  is_builtin: boolean;
};

type Tab = "installed" | "browse" | "create";

const TABS: { value: Tab; label: string }[] = [
  { value: "installed", label: "Installed" },
  { value: "browse", label: "Browse" },
  { value: "create", label: "Create" },
];

export default function SkillsPage() {
  const [tab, setTab] = useState<Tab>("installed");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

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

  const handleToggle = async (id: string, active: boolean) => {
    // Optimistic update
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: active } : s))
    );
    try {
      await fetch(`/api/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });
    } catch {
      // Revert
      setSkills((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !active } : s))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this skill?")) return;
    setSkills((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/skills/${id}`, { method: "DELETE" });
    } catch {
      fetchSkills();
    }
  };

  const handleInstallBuiltin = async (slug: string) => {
    // Seed all builtins, then refetch
    await fetch("/api/skills/seed", { method: "POST" });
    fetchSkills();
  };

  const installedSlugs = new Set(skills.map((s) => s.slug));
  const availableBuiltins = BUILTIN_SKILLS.filter(
    (b) => !installedSlugs.has(b.slug)
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Puzzle className="h-5 w-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold">Skills</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Extend Granger&apos;s capabilities with specialized skills.
        </p>
      </div>

      {/* Guide */}
      <div className="mb-6 rounded-lg border bg-card">
        <button
          onClick={() => setGuideOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
        >
          <span>How Skills Work</span>
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
              <h4 className="font-medium text-foreground mb-1">
                What is a Skill?
              </h4>
              <p>
                A skill is a bundle of: instructions (system prompt) + tools +
                configuration. When activated, the skill&apos;s instructions are
                added to Granger&apos;s context.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">
                Using Skills
              </h4>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  Type <code className="text-xs bg-muted px-1 rounded">/</code>{" "}
                  followed by a skill&apos;s slash command (e.g.,{" "}
                  <code className="text-xs bg-muted px-1 rounded">/pm</code> for
                  Project Manager)
                </li>
                <li>
                  Or say &ldquo;use the [skill name] skill&rdquo;
                </li>
                <li>
                  Granger loads the skill&apos;s specialized instructions for
                  your conversation
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">
                Built-in Skills
              </h4>
              <p>
                Granger comes with 6 built-in skills: Linear PM, Email Drafter,
                Meeting Summarizer, Code Builder, Weekly Digest, and Brand Voice
                Writer.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">
                Creating Custom Skills
              </h4>
              <p>
                Click &ldquo;Create&rdquo; to build your own skill with a custom
                system prompt, selected tools, and a slash command.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-1">
                Skills vs Tools
              </h4>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  <strong>Tools</strong> are specific actions (search Gmail,
                  create Linear issue)
                </li>
                <li>
                  <strong>Skills</strong> are personalities/modes that combine
                  tools with specialized knowledge
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {TABS.map((t) => (
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
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Installed tab */}
          {tab === "installed" && (
            <>
              {skills.length === 0 ? (
                <div className="text-center py-12">
                  <Puzzle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    No skills installed yet.
                  </p>
                  <button
                    onClick={() => setTab("browse")}
                    className="text-sm text-primary hover:underline"
                  >
                    Browse available skills
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {skills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onToggle={handleToggle}
                      onDelete={skill.is_builtin ? undefined : handleDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Browse tab */}
          {tab === "browse" && (
            <div className="space-y-6">
              {availableBuiltins.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Built-in Skills</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {availableBuiltins.map((skill) => (
                      <div
                        key={skill.slug}
                        className="rounded-lg border bg-card p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl shrink-0">{skill.icon}</span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm">
                              {skill.name}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {skill.description}
                            </p>
                            {skill.slashCommand && (
                              <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground mt-2 inline-block">
                                {skill.slashCommand}
                              </code>
                            )}
                          </div>
                          <button
                            onClick={() => handleInstallBuiltin(skill.slug)}
                            className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            Install
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableBuiltins.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">
                    All built-in skills are installed.
                  </p>
                </div>
              )}

              {/* Marketplace teaser */}
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <Puzzle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <h3 className="text-sm font-medium mb-1">
                  Skill Marketplace
                </h3>
                <p className="text-xs text-muted-foreground">
                  Community and third-party skills coming soon.
                </p>
              </div>
            </div>
          )}

          {/* Create tab */}
          {tab === "create" && (
            <SkillCreator
              onCreated={() => {
                setTab("installed");
                fetchSkills();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
