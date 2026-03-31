"use client";

import { useCallback, useEffect, useState } from "react";
import { SkillCard } from "@/components/skill-card";
import { SkillCreator } from "@/components/skill-creator";
import { BUILTIN_SKILLS } from "@/lib/skills/types";
import { SKILLS_REGISTRY, SKILL_CATEGORIES, searchSkills, searchSkillsMarketplace, type MarketplaceSkill, type SkillCategory } from "@/lib/skills/registry";
import { cn } from "@/lib/utils";
import { ChevronDown, ExternalLink, Loader2, Puzzle, Search, Code2 } from "lucide-react";
import { SkillsEditor } from "@/components/skills-editor";

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
  reference_files?: { name: string; content: string; type: "text" | "markdown" | "code" }[];
};


type Tab = "installed" | "browse" | "create" | "editor";

const TABS: { value: Tab; label: string }[] = [
  { value: "installed", label: "Installed" },
  { value: "browse", label: "Browse" },
  { value: "create", label: "Create" },
  { value: "editor", label: "Editor" },
];

export default function SkillsPage() {
  const [tab, setTab] = useState<Tab>("installed");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseCategory, setBrowseCategory] = useState<SkillCategory>("all");
  const [liveResults, setLiveResults] = useState<{ name: string; source: string; installs: number; id: string; installCommand: string; url: string }[]>([]);
  const [liveSearching, setLiveSearching] = useState(false);

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

  // Debounced live search against skills.sh API
  useEffect(() => {
    if (!browseSearch.trim() || browseSearch.length < 2) {
      setLiveResults([]);
      return;
    }
    setLiveSearching(true);
    const timeout = setTimeout(async () => {
      const results = await searchSkillsMarketplace(browseSearch, 20);
      setLiveResults(results);
      setLiveSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [browseSearch]);

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

  const [installingMarketplace, setInstallingMarketplace] = useState<
    string | null
  >(null);
  const [installingLive, setInstallingLive] = useState<string | null>(null);
  const [installedLive, setInstalledLive] = useState<Set<string>>(new Set());

  const handleInstallLive = async (skill: { name: string; source: string; id: string }) => {
    setInstallingLive(skill.id);
    try {
      const slug = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let systemPrompt = `Installed from skills.sh. Source: ${skill.source}/${skill.name}`;
      try {
        const mdUrl = `https://raw.githubusercontent.com/${skill.source}/main/.claude/skills/${skill.name}/SKILL.md`;
        const mdRes = await fetch(mdUrl);
        if (mdRes.ok) {
          systemPrompt = await mdRes.text();
        }
      } catch {
        // Use placeholder if fetch fails
      }
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skill.name,
          slug,
          description: "Installed from skills.sh",
          systemPrompt,
          category: "marketplace",
          icon: "\uD83D\uDCE6",
          isActive: true,
          source: skill.source,
          tools: [],
        }),
      });
      if (res.ok) {
        setInstalledLive((prev) => new Set(prev).add(skill.id));
        fetchSkills();
      }
    } catch {
      // silent
    } finally {
      setInstallingLive(null);
    }
  };

  const handleInstallMarketplace = async (skill: MarketplaceSkill) => {
    setInstallingMarketplace(skill.slug);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skill.name,
          slug: skill.slug,
          description: skill.description,
          icon: skill.icon,
          category: skill.category,
          systemPrompt: `You are a ${skill.name} specialist. ${skill.description}. Use your expertise to help the user with tasks related to this domain. Source: ${skill.source}`,
          slashCommand: `/${skill.slug}`,
          tools: [],
        }),
      });
      if (res.ok) {
        fetchSkills();
      }
    } catch {
      // silent
    } finally {
      setInstallingMarketplace(null);
    }
  };

  const installedSlugs = new Set(skills.map((s) => s.slug));
  const availableBuiltins = BUILTIN_SKILLS.filter(
    (b) => !installedSlugs.has(b.slug)
  );
  const filteredSkills = searchSkills(browseSearch, browseCategory);
  const availableMarketplace = filteredSkills.filter(
    (m) => !installedSlugs.has(m.slug)
  );

  return (
    <div className={cn("p-4 sm:p-8", tab === "editor" ? "max-w-full" : "max-w-4xl")}>
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
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={browseSearch}
                  onChange={(e) => setBrowseSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Category filter pills */}
              <div className="flex flex-wrap gap-2">
                {SKILL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setBrowseCategory(cat.value)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full font-medium transition-colors",
                      browseCategory === cat.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Skill count */}
              <p className="text-xs text-muted-foreground">
                {availableMarketplace.length} skill{availableMarketplace.length !== 1 ? 's' : ''} available
                {browseSearch && ` matching "${browseSearch}"`}
                {browseCategory !== 'all' && ` in ${browseCategory}`}
              </p>

              {/* Built-in skills (only shown when not searching) */}
              {!browseSearch && browseCategory === 'all' && availableBuiltins.length > 0 && (
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

              {/* Registry skills */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">
                    {browseSearch || browseCategory !== 'all' ? 'Results' : 'Community Skills'}
                  </h3>
                  <a
                    href="https://skills.sh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    skills.sh registry
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {availableMarketplace.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {availableMarketplace.map((skill) => (
                      <div
                        key={skill.slug}
                        className="rounded-lg border bg-card p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl shrink-0">
                            {skill.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm">
                              {skill.name}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {skill.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                  skill.author === "Vercel"
                                    ? "bg-foreground text-background"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {skill.author}
                              </span>
                              <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                                /{skill.slug}
                              </code>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInstallMarketplace(skill)}
                            disabled={installingMarketplace === skill.slug}
                            className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {installingMarketplace === skill.slug ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Install"
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">
                      {browseSearch
                        ? `No skills found matching "${browseSearch}".`
                        : "All available skills are installed."}
                    </p>
                  </div>
                )}
              </div>

              {/* Live skills.sh API results */}
              {browseSearch.length >= 2 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      Live from skills.sh
                      {liveSearching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {liveResults.length} result{liveResults.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {liveResults.length > 0 ? (
                    <div className="grid gap-2">
                      {liveResults.map((skill) => (
                        <div
                          key={skill.id}
                          className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm font-mono">{skill.name}</h4>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {skill.installs.toLocaleString()} installs
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{skill.source}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <code className="text-[10px] px-2 py-1 rounded bg-muted font-mono text-muted-foreground hidden sm:block">
                              {skill.installCommand}
                            </code>
                            <a
                              href={skill.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                            {installedLive.has(skill.id) ? (
                              <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                                Installed &#10003;
                              </span>
                            ) : (
                              <button
                                onClick={() => handleInstallLive(skill)}
                                disabled={installingLive === skill.id}
                                className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                {installingLive === skill.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Install"
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !liveSearching ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No results from skills.sh for &quot;{browseSearch}&quot;
                    </p>
                  ) : null}
                </div>
              )}

              {/* Footer link */}
              <div className="text-center pt-2 pb-4 border-t">
                <a
                  href="https://skills.sh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Browse more at skills.sh
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
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

          {/* Editor tab */}
          {tab === "editor" && <SkillsEditor />}
        </>
      )}
    </div>
  );
}
