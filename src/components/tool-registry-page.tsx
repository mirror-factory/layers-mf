"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Wrench,
  Plug,
  Sparkles,
  Database,
  Globe,
  Terminal,
  FileText,
  Clock,
  Shield,
  Bot,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NeuralDots } from "@/components/ui/neural-dots";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToolCategory =
  | "Knowledge"
  | "Agents"
  | "Code/Sandbox"
  | "Documents"
  | "Scheduling"
  | "Web"
  | "Skills"
  | "Compliance"
  | "Artifacts";

interface SchemaParam {
  type: string;
  required?: boolean;
  description?: string;
  values?: string[];
}

interface BuiltInTool {
  name: string;
  category: ToolCategory;
  description: string;
  inputSchema: Record<string, SchemaParam>;
  hasExecute: boolean;
  status: "active" | "beta" | "deprecated";
}

interface MCPServer {
  serverName: string;
  tools: string[];
}

interface SkillEntry {
  name: string;
  slug: string;
  tools: string[];
}

interface RegistryData {
  builtIn: BuiltInTool[];
  mcp: MCPServer[];
  skills: SkillEntry[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ALL_CATEGORIES: ToolCategory[] = [
  "Knowledge",
  "Agents",
  "Code/Sandbox",
  "Documents",
  "Scheduling",
  "Web",
  "Skills",
  "Compliance",
  "Artifacts",
];

const CATEGORY_ICONS: Record<ToolCategory, typeof Database> = {
  Knowledge: Database,
  Agents: Bot,
  "Code/Sandbox": Terminal,
  Documents: FileText,
  Scheduling: Clock,
  Web: Globe,
  Skills: Sparkles,
  Compliance: Shield,
  Artifacts: Layers,
};

const CATEGORY_COLORS: Record<ToolCategory, string> = {
  Knowledge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Agents: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Code/Sandbox": "bg-green-500/10 text-green-400 border-green-500/20",
  Documents: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Scheduling: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Web: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Skills: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Compliance: "bg-red-500/10 text-red-400 border-red-500/20",
  Artifacts: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-emerald-400"
      : status === "beta"
        ? "bg-amber-400"
        : "bg-zinc-500";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} />;
}

function ToolCard({
  tool,
  expanded,
  onToggle,
}: {
  tool: BuiltInTool;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = CATEGORY_ICONS[tool.category] ?? Wrench;
  const schemaEntries = Object.entries(tool.inputSchema);

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        "bg-card hover:bg-accent/30",
        expanded && "ring-1 ring-primary/20",
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div
          className={cn(
            "flex items-center justify-center h-9 w-9 rounded-md border shrink-0 mt-0.5",
            CATEGORY_COLORS[tool.category],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-medium">{tool.name}</code>
            <StatusDot status={tool.status} />
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[tool.category])}
            >
              {tool.category}
            </Badge>
            {!tool.hasExecute && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashed">
                client-side
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {tool.description}
          </p>
        </div>

        <div className="shrink-0 mt-1 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {expanded && schemaEntries.length > 0 && (
        <div className="border-t px-4 pb-4 pt-3">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Input Schema
          </h4>
          <div className="space-y-1.5">
            {schemaEntries.map(([key, param]) => (
              <div key={key} className="flex items-baseline gap-2 text-xs">
                <code className="text-primary font-mono shrink-0">{key}</code>
                <span className="text-muted-foreground">
                  {param.type}
                  {param.values && ` (${param.values.join(" | ")})`}
                  {param.required === false && (
                    <span className="italic ml-1">optional</span>
                  )}
                </span>
                {param.description && (
                  <span className="text-muted-foreground/70 truncate">
                    -- {param.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, href, linkText }: { text: string; href: string; linkText: string }) {
  return (
    <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
      {text}{" "}
      <a href={href} className="text-primary underline underline-offset-2">{linkText}</a>.
    </div>
  );
}

function ToolChips({ tools, max = 8 }: { tools: string[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tools.slice(0, max).map((t) => (
        <code key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</code>
      ))}
      {tools.length > max && (
        <span className="text-[10px] text-muted-foreground">+{tools.length - max} more</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ToolRegistryPage() {
  const [data, setData] = useState<RegistryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all">("all");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tools/registry")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredTools = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.builtIn.filter((t) => {
      const matchesCategory =
        activeCategory === "all" || t.category === activeCategory;
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [data, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    if (!data) return {};
    const counts: Record<string, number> = {};
    for (const t of data.builtIn) {
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <NeuralDots size={48} dotCount={12} active />
        <span className="text-sm text-muted-foreground">Loading tool registry...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <NeuralDots size={32} dotCount={8} />
          <h1 className="text-2xl font-semibold">Tool Registry</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          All tools available to the AI agent. {data?.builtIn.length ?? 0} built-in,{" "}
          {data?.mcp.reduce((s, m) => s + m.tools.length, 0) ?? 0} MCP,{" "}
          {data?.skills.length ?? 0} skill-based.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools by name, description, or category..."
          className="pl-9"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory("all")}
          className={cn(
            "text-xs px-2.5 py-1 rounded-md border transition-colors",
            activeCategory === "all"
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-transparent text-muted-foreground border-border hover:bg-accent",
          )}
        >
          All ({data?.builtIn.length ?? 0})
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md border transition-colors",
                activeCategory === cat
                  ? cn("border-primary/30", CATEGORY_COLORS[cat])
                  : "bg-transparent text-muted-foreground border-border hover:bg-accent",
              )}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Built-in tools */}
      <section>
        <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          Built-in Tools
          <span className="text-xs text-muted-foreground font-normal">
            ({filteredTools.length})
          </span>
        </h2>
        <div className="grid gap-2">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.name}
              tool={tool}
              expanded={expandedTool === tool.name}
              onToggle={() =>
                setExpandedTool(expandedTool === tool.name ? null : tool.name)
              }
            />
          ))}
          {filteredTools.length === 0 && (
            <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
              No tools match your search.
            </div>
          )}
        </div>
      </section>

      {/* MCP tools */}
      <section>
        <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          MCP Tools
          <span className="text-xs text-muted-foreground font-normal">
            ({data?.mcp.reduce((s, m) => s + m.tools.length, 0) ?? 0} from {data?.mcp.length ?? 0} servers)
          </span>
        </h2>
        {(data?.mcp ?? []).length === 0 ? (
          <EmptyState text="No MCP servers connected. Add servers at" href="/mcp" linkText="/mcp" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(data?.mcp ?? []).map((server) => (
              <div key={server.serverName} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Plug className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium">{server.serverName}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{server.tools.length} tools</Badge>
                </div>
                {server.tools.length > 0 && <ToolChips tools={server.tools} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Skill tools */}
      <section>
        <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Skill Tools
          <span className="text-xs text-muted-foreground font-normal">({data?.skills.length ?? 0} active)</span>
        </h2>
        {(data?.skills ?? []).length === 0 ? (
          <EmptyState text="No active skills. Create or install skills at" href="/skills" linkText="/skills" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(data?.skills ?? []).map((skill) => (
              <div key={skill.slug} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-pink-400" />
                  <span className="text-sm font-medium">{skill.name}</span>
                  <code className="text-[10px] text-muted-foreground ml-auto">/{skill.slug}</code>
                </div>
                {skill.tools.length > 0 && <ToolChips tools={skill.tools} max={12} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
