"use client";

import { useState, useRef, useCallback, useEffect, useMemo, createContext, useContext } from "react";
import {
  ArrowRight, BarChart3, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight,
  Clock, DollarSign, Download, Layers, List, MessageSquare, Sparkles,
  Target, X, Zap, RefreshCw, Lightbulb, Loader2, Send,
  Phone, Users, Briefcase, FileText, Bell, GitBranch, Search as SearchIcon,
  Sun, Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalData, PortalDocument } from "@/app/portal/[token]/page";
import { ChatInterface } from "@/components/chat-interface";

// ---------------------------------------------------------------------------
// Theme context
// ---------------------------------------------------------------------------

type PortalTheme = "dark" | "light";
const ThemeContext = createContext<{ isDark: boolean; theme: PortalTheme }>({ isDark: true, theme: "dark" });
function usePortalTheme() { return useContext(ThemeContext); }


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocSection {
  id: string;
  type:
    | "hero" | "heading" | "paragraph" | "list" | "data-table"
    | "phase-timeline" | "budget-table" | "milestone-timeline"
    | "divider" | "comparison-table" | "architecture-diagram"
    | "jtbd-list" | "feature-spec" | "acceptance-criteria"
    | "priority-matrix" | "flow-diagram";
  level?: number;
  title?: string;
  content: string;
  items?: string[];
  tableRows?: string[][];
  tableHeaders?: string[];
  phases?: { name: string; timeline: string; description: string; investment?: string }[];
  budgetRows?: { phase: string; timeline: string; investment: string }[];
  milestones?: { phase: string; dates: string; milestones: string }[];
  // New fields for enhanced section types
  comparisons?: { label: string; current: string; target: string }[];
  architectureLayers?: { layer: string; owner: string; contains: string }[];
  jtbdItems?: { when: string; want: string; soThat: string }[];
  featureSpecs?: { name: string; priority: string; description: string; acceptance: string[] }[];
  priorityRows?: { feature: string; must: string; should: string; could: string; deferred: string }[];
  diagramType?: "inbound-triage" | "outbound-screening";
}

interface TocEntry { id: string; title: string; level: number; }

// ---------------------------------------------------------------------------
// Parser Helpers
// ---------------------------------------------------------------------------

function cleanBold(s: string): string { return s.replace(/\*\*/g, "").replace(/\\\\/g, "").replace(/\\([~<>*_`#])/g, "$1").trim(); }

function isSeparatorRow(cells: string[]): boolean { return cells.every(c => /^[:\-\s]*$/.test(c)); }

function parseMarkdownTable(lines: string[], startIdx: number): { headers: string[]; rows: string[][]; endIdx: number } {
  const headers = lines[startIdx].split("|").map(c => cleanBold(c.trim())).filter(Boolean);
  let j = startIdx + 1;
  if (j < lines.length && /^[|\s:-]+$/.test(lines[j].trim())) j++;
  const rows: string[][] = [];
  while (j < lines.length && lines[j].trim().startsWith("|")) {
    const cells = lines[j].split("|").map(c => cleanBold(c.trim())).filter(Boolean);
    if (cells.length > 0 && !isSeparatorRow(cells)) rows.push(cells);
    j++;
  }
  // Also filter separator-like headers (if first row was a separator)
  const cleanHeaders = isSeparatorRow(headers) ? [] : headers;
  return { headers: cleanHeaders, rows, endIdx: j };
}

// ---------------------------------------------------------------------------
// Document Parser
// ---------------------------------------------------------------------------

function parseDocument(content: string, portalTitle: string, clientName: string): DocSection[] {
  if (!content) return [];
  // Pre-filter: remove empty lines so triplet patterns (Phase/Timeline/Investment) work
  const lines = content.split("\n").filter(l => l.trim() !== "");
  const sections: DocSection[] = [];
  let idx = 0;

  sections.push({ id: "hero", type: "hero", title: portalTitle, content: clientName });

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i].trim();
    if (!raw) { i++; continue; }

    // Flow diagram detection — inbound call triage
    const rawLower = raw.toLowerCase();
    if (
      (rawLower.includes("inbound call triage") || rawLower.includes("ai receptionist answers calls") || rawLower.includes("ai receptionist")) &&
      !sections.some(s => s.type === "flow-diagram" && s.diagramType === "inbound-triage")
    ) {
      idx++;
      sections.push({ id: `s-${idx}`, type: "flow-diagram", diagramType: "inbound-triage", content: raw });
      // Don't skip the line — let it also render as heading/paragraph below
    }

    // Flow diagram detection — outbound candidate screening
    if (
      (rawLower.includes("outbound candidate screening") || rawLower.includes("screens hundreds of candidates") || rawLower.includes("outbound screening")) &&
      !sections.some(s => s.type === "flow-diagram" && s.diagramType === "outbound-screening")
    ) {
      idx++;
      sections.push({ id: `s-${idx}`, type: "flow-diagram", diagramType: "outbound-screening", content: raw });
    }

    // Skip metadata
    if (/^(\*\*)?!?\[/.test(raw)) { i++; continue; }
    if (/^(Prepared (by|for)|Date:|Revision:|\*\*Prepared|\*\*Date|\*\*Revision)/i.test(cleanBold(raw))) { i++; continue; }
    if (/\bx\b/.test(cleanBold(raw)) && raw.length < 80 && i < 15) { i++; continue; }

    // Markdown tables
    if (raw.startsWith("|") && raw.includes("|")) {
      const { headers, rows, endIdx } = parseMarkdownTable(lines, i);
      if (headers.length >= 2 && rows.length > 0) {
        idx++;

        // Detect comparison table (Current State / Target State)
        const currentCol = headers.findIndex(h => /current\s*state/i.test(h));
        const targetCol = headers.findIndex(h => /target\s*state/i.test(h));
        const outcomeCol = headers.findIndex(h => /outcome|metric|kpi/i.test(h));
        if (currentCol >= 0 && targetCol >= 0) {
          const labelCol = outcomeCol >= 0 ? outcomeCol : 0;
          sections.push({
            id: `s-${idx}`, type: "comparison-table", content: "",
            comparisons: rows.map(r => ({
              label: r[labelCol] || "",
              current: r[currentCol] || "",
              target: r[targetCol] || "",
            })),
          });
          i = endIdx; continue;
        }

        // Detect architecture table (Layer/Owner/Contains)
        const layerCol = headers.findIndex(h => /layer/i.test(h));
        const ownerCol = headers.findIndex(h => /owner/i.test(h));
        const containsCol = headers.findIndex(h => /contains|components?|includes?/i.test(h));
        if (layerCol >= 0 && ownerCol >= 0 && containsCol >= 0 && rows.length >= 2) {
          sections.push({
            id: `s-${idx}`, type: "architecture-diagram", content: "",
            architectureLayers: rows.map(r => ({
              layer: r[layerCol] || "",
              owner: r[ownerCol] || "",
              contains: r[containsCol] || "",
            })),
          });
          i = endIdx; continue;
        }

        // Detect priority matrix (Must/Should/Could columns)
        const mustCol = headers.findIndex(h => /^must$/i.test(h.trim()));
        const shouldCol = headers.findIndex(h => /^should$/i.test(h.trim()));
        const couldCol = headers.findIndex(h => /^could$/i.test(h.trim()));
        const deferCol = headers.findIndex(h => /^deferred?$/i.test(h.trim()));
        const featureCol = headers.findIndex(h => /feature|group|category/i.test(h));
        if (mustCol >= 0 && shouldCol >= 0 && featureCol >= 0) {
          sections.push({
            id: `s-${idx}`, type: "priority-matrix", content: "",
            priorityRows: rows.map(r => ({
              feature: r[featureCol] || "",
              must: r[mustCol] || "",
              should: r[shouldCol] || "",
              could: couldCol >= 0 ? (r[couldCol] || "") : "",
              deferred: deferCol >= 0 ? (r[deferCol] || "") : "",
            })),
          });
          i = endIdx; continue;
        }

        // Detect budget table (has Investment/Cost column)
        const investCol = headers.findIndex(h => /investment|cost|price/i.test(h));
        const phaseCol = headers.findIndex(h => /phase|item|component/i.test(h));
        const timeCol = headers.findIndex(h => /timeline|duration|time/i.test(h));
        if (investCol >= 0 && phaseCol >= 0 && rows.length >= 2) {
          sections.push({
            id: `s-${idx}`, type: "budget-table", content: "",
            budgetRows: rows.map(r => ({
              phase: r[phaseCol] || "",
              timeline: timeCol >= 0 ? (r[timeCol] || "") : "",
              investment: r[investCol] || "",
            })),
          });
          i = endIdx; continue;
        }

        // Detect milestone table
        const dateCol = headers.findIndex(h => /dates?|target|when/i.test(h));
        const msCol = headers.findIndex(h => /milestone|deliverable|key/i.test(h));
        if (dateCol >= 0 && msCol >= 0 && phaseCol >= 0 && rows.length >= 2) {
          sections.push({
            id: `s-${idx}`, type: "milestone-timeline", content: "",
            milestones: rows.map(r => ({
              phase: r[phaseCol] || "",
              dates: r[dateCol] || "",
              milestones: r[msCol] || "",
            })),
          });
          i = endIdx; continue;
        }

        // Generic table
        sections.push({ id: `s-${idx}`, type: "data-table", content: "", tableHeaders: headers, tableRows: rows });
        i = endIdx; continue;
      }
    }

    // Phase blocks (plain text format)
    const phaseMatch = raw.match(/^Phase\s+(\d+)[\s:]+(.+)/i);
    if (phaseMatch && !raw.startsWith("|")) {
      const phases: DocSection["phases"] = [];
      let j = i;
      while (j < lines.length) {
        const pLine = lines[j].trim();
        const pm = pLine.match(/^Phase\s+(\d+)[\s:]+(.+)/i);
        if (!pm && phases.length > 0) break;
        if (pm) {
          j++;
          const descLines: string[] = [];
          while (j < lines.length) {
            const dl = lines[j].trim();
            if (!dl || dl.match(/^Phase\s+\d+/i) || dl.match(/^\*?\*?\d+\\?\.\s/) || dl.match(/^#{1,4}\s/) || dl.startsWith("|")) break;
            descLines.push(cleanBold(dl));
            j++;
          }
          phases.push({ name: `Phase ${pm[1]}`, timeline: cleanBold(pm[2]).replace(/[()]/g, "").trim(), description: descLines.join(" ") });
        } else { j++; }
      }
      if (phases.length >= 2) { idx++; sections.push({ id: `s-${idx}`, type: "phase-timeline", content: "", phases }); i = j; continue; }
    }

    // Budget triplet format
    if (/^Phase$/i.test(cleanBold(raw)) && i + 1 < lines.length && /timeline/i.test(cleanBold(lines[i + 1])) && i + 2 < lines.length && /investment/i.test(cleanBold(lines[i + 2]))) {
      const budgetRows: DocSection["budgetRows"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = cleanBold(lines[j]), t = cleanBold(lines[j + 1]), inv = cleanBold(lines[j + 2]);
        if (!p || /^(Phase\s*$|Timeline|Milestones)/i.test(p)) break;
        // Stop if this doesn't look like a budget row — investment should have $ or "Scoped" or "TBD"
        if (!inv.includes("$") && !/scoped|tbd|n\/a|included|see|pending/i.test(inv)) break;
        budgetRows.push({ phase: p, timeline: t, investment: inv });
        j += 3;
      }
      if (budgetRows.length > 0) { idx++; sections.push({ id: `s-${idx}`, type: "budget-table", content: "", budgetRows }); i = j; continue; }
    }

    // Milestone triplet format
    if (/^Phase$/i.test(cleanBold(raw)) && i + 1 < lines.length && /target dates/i.test(cleanBold(lines[i + 1])) && i + 2 < lines.length && /key milestones/i.test(cleanBold(lines[i + 2]))) {
      const milestones: DocSection["milestones"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = cleanBold(lines[j]), d = cleanBold(lines[j + 1]), m = cleanBold(lines[j + 2]);
        if (!p || /^(Timeline|Phase\s*$)/i.test(p)) break;
        milestones.push({ phase: p, dates: d, milestones: m });
        j += 3;
      }
      if (milestones.length > 0) { idx++; sections.push({ id: `s-${idx}`, type: "milestone-timeline", content: "", milestones }); i = j; continue; }
    }

    // Numbered headings with sub-numbering: **5.1.2 Title** or 5.1 Title
    const subNumHeading = cleanBold(raw).match(/^(\d+(?:\.\d+)+)\.?\s+(.{2,100})/);
    if (subNumHeading && raw.length < 120) {
      idx++;
      const depth = subNumHeading[1].split(".").length;
      const level = Math.min(depth, 3);
      sections.push({ id: `s-${idx}`, type: "heading", level, title: cleanBold(subNumHeading[2]), content: "" });
      i++; continue;
    }

    // Numbered headings: **1. Title** or 1. Title
    const numHeading = cleanBold(raw).match(/^(\d+)\\?\.\s+(.{2,100})/);
    if (numHeading && raw.length < 120) {
      idx++; sections.push({ id: `s-${idx}`, type: "heading", level: 1, title: cleanBold(numHeading[2]), content: "" }); i++; continue;
    }

    // Bold sub-section headings: **Title**
    if (/^\*\*[^*]+\*\*$/.test(raw) && raw.length < 100) {
      const title = cleanBold(raw);
      if (title.length >= 3 && !/^(Prepared|Date|Revision)/.test(title)) {
        idx++;
        const level = /^\d/.test(title) ? 2 : 3;
        sections.push({ id: `s-${idx}`, type: "heading", level, title, content: "" }); i++; continue;
      }
    }

    // Markdown headings
    const mdHeading = raw.match(/^(#{1,4})\s+(.+)/);
    if (mdHeading) { idx++; sections.push({ id: `s-${idx}`, type: "heading", level: mdHeading[1].length, title: cleanBold(mdHeading[2]), content: "" }); i++; continue; }

    // Short title-like lines
    const cleaned = cleanBold(raw);
    if (cleaned.length >= 3 && cleaned.length < 60 && !cleaned.includes(". ") && !cleaned.endsWith(".") && /^[A-Z]/.test(cleaned)
      && !/^(Phase|The |A |An |In |On |At |By |To |If |No |When |Every |Full |Mirror |Swell |Blue|Charlie|This )/.test(cleaned)) {
      idx++; sections.push({ id: `s-${idx}`, type: "heading", level: 3, title: cleaned, content: "" }); i++; continue;
    }

    // List items — detect JTBD pattern and feature spec pattern
    if (raw.startsWith("- ") || raw.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("- ") || l.startsWith("* ")) {
          items.push(cleanBold(l.slice(2)));
        } else break;
        i++;
      }

      // Check for JTBD pattern: "When..., I want..., so that..."
      const jtbdItems: DocSection["jtbdItems"] = [];
      for (const item of items) {
        const jtbdMatch = item.match(/^When\s+(.+?),?\s+I want\s+(.+?),?\s+so that\s+(.+)$/i);
        if (jtbdMatch) {
          jtbdItems.push({ when: jtbdMatch[1].trim(), want: jtbdMatch[2].trim(), soThat: jtbdMatch[3].trim() });
        }
      }
      if (jtbdItems.length >= 2) {
        idx++; sections.push({ id: `s-${idx}`, type: "jtbd-list", content: "", jtbdItems }); continue;
      }

      // Check for acceptance criteria pattern (all items look like testable criteria)
      const allCriteria = items.length >= 2 && items.every(it =>
        /^(Given|When|Then|User can|System (should|must|shall)|The |It |Must |Should |Shall )/i.test(it) ||
        /\b(displays?|shows?|returns?|validates?|creates?|updates?|deletes?|sends?|receives?|stores?|loads?)\b/i.test(it)
      );
      if (allCriteria) {
        idx++; sections.push({ id: `s-${idx}`, type: "acceptance-criteria", content: "", items }); continue;
      }

      idx++; sections.push({ id: `s-${idx}`, type: "list", content: "", items }); continue;
    }

    // Divider
    if (raw.match(/^[-=_*]{3,}$/)) { sections.push({ id: `div-${idx}`, type: "divider", content: "" }); i++; continue; }

    // Paragraph — detect feature spec blocks (Priority: X / Description: Y / Acceptance Criteria: ...)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ") && !lines[i].trim().startsWith("|") && !cleanBold(lines[i]).match(/^\d+(?:\.\d+)*\\?\.\s+[A-Z]/) && !/^\*\*[^*]+\*\*$/.test(lines[i].trim())) {
      paraLines.push(cleanBold(lines[i])); i++;
    }
    if (paraLines.length > 0) { idx++; sections.push({ id: `s-${idx}`, type: "paragraph", content: paraLines.join(" ") }); }
    else { i++; } // SAFETY: always advance to prevent infinite loop on unmatched lines
  }

  // Post-process: merge consecutive heading + paragraph with Priority/Description into feature-spec
  const merged: DocSection[] = [];
  for (let si = 0; si < sections.length; si++) {
    const s = sections[si];
    // Detect feature spec: heading followed by paragraph containing "Priority:" and "Description:"
    if (s.type === "paragraph" && /Priority:\s*(Must|Should|Could|Deferred|Won't)/i.test(s.content)) {
      const priorityMatch = s.content.match(/Priority:\s*(Must|Should|Could|Deferred|Won't)/i);
      const descMatch = s.content.match(/Description:\s*(.+?)(?=Acceptance Criteria:|$)/i);
      const acMatch = s.content.match(/Acceptance Criteria:\s*(.+)/i);
      if (priorityMatch) {
        // Look for the heading right before this paragraph
        const prevSection = merged[merged.length - 1];
        const featureName = prevSection && prevSection.type === "heading" ? prevSection.title || "" : "";
        if (featureName) merged.pop(); // remove the heading, we'll incorporate it

        const acceptance = acMatch ? acMatch[1].split(/[;.]/).map(a => a.trim()).filter(Boolean) : [];
        merged.push({
          id: s.id, type: "feature-spec", content: "",
          featureSpecs: [{
            name: featureName,
            priority: priorityMatch[1],
            description: descMatch ? descMatch[1].trim() : s.content,
            acceptance,
          }],
        });
        continue;
      }
    }
    merged.push(s);
  }

  return merged;
}

function buildToc(sections: DocSection[]): TocEntry[] {
  return sections.filter(s => s.type === "heading" && s.title && (s.level ?? 1) <= 2).map(s => ({ id: s.id, title: s.title!, level: s.level ?? 1 }));
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

// Scroll animation removed for performance — the 77K Scope of Work doc
// creates hundreds of sections, each with an IntersectionObserver, crashing tabs.
// All sections render immediately; CSS handles visual polish.
function useScrollAnimation(_delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  return { ref, isVisible: true };
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function GlassCard({ children, className, brandColor, glowOnHover = false, style }: {
  children: React.ReactNode; className?: string; brandColor?: string; glowOnHover?: boolean; style?: React.CSSProperties;
}) {
  const { isDark } = usePortalTheme();
  return (
    <div
      className={cn(
        "relative rounded-2xl border backdrop-blur-sm",
        "transition-all duration-300",
        isDark
          ? "border-white/[0.06] bg-white/[0.018]"
          : "border-gray-200 bg-gray-50/80",
        glowOnHover && (isDark
          ? "hover:border-white/[0.12] hover:bg-white/[0.03]"
          : "hover:border-gray-300 hover:bg-gray-50"),
        className,
      )}
      style={style}
    >
      {brandColor && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ boxShadow: `inset 0 1px 0 0 ${brandColor}15, 0 0 20px ${brandColor}05` }}
        />
      )}
      {children}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase().trim();
  const config = p === "must"
    ? { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/25" }
    : p === "should"
    ? { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/25" }
    : p === "could"
    ? { bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/20" }
    : { bg: "bg-red-500/10", text: "text-red-400/70", border: "border-red-500/20" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", config.bg, config.text, config.border)}>
      {priority}
    </span>
  );
}

// Render inline bold markers with <strong> styling
function RichText({ text, className }: { text: string; className?: string }) {
  // The cleanBold already stripped **, but let's handle em-dashes, colons nicely
  return <span className={className}>{text}</span>;
}

// ---------------------------------------------------------------------------
// Floating TOC (compact dropdown)
// ---------------------------------------------------------------------------

function FloatingToc({ entries, brandColor }: { entries: TocEntry[]; brandColor: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = usePortalTheme();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div ref={ref} className="fixed left-4 top-16 z-[60]">
      <button onClick={() => setOpen(!open)}
        className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs backdrop-blur-xl transition-all",
          isDark ? "border-white/[0.08] bg-[#0a0a0f]/90 text-white/50 hover:bg-white/[0.05] hover:text-white/80"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm")}>
        <BookOpen className="h-3.5 w-3.5" style={{ color: brandColor }} />
        Contents
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn("absolute left-0 top-full mt-1 w-72 max-h-[60vh] overflow-y-auto rounded-xl border p-2 backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150",
          isDark ? "border-white/[0.08] bg-[#0a0a0f]/95 shadow-2xl" : "border-gray-200 bg-white shadow-lg")}>
          {entries.map(e => (
            <button key={e.id} onClick={() => { document.getElementById(e.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); setOpen(false); }}
              className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all",
                isDark ? "text-white/50 hover:bg-white/[0.05] hover:text-white/80" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800")}
              style={{ paddingLeft: `${(e.level - 1) * 12 + 12}px` }}>
              <ChevronRight className="h-2.5 w-2.5 shrink-0" style={{ color: brandColor }} />
              <span className={cn("line-clamp-1", e.level === 1 && (isDark ? "font-medium text-white/60" : "font-medium text-gray-700"))}>{e.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive Chart Wrapper
// ---------------------------------------------------------------------------

function InteractiveChart({ config, brandColor, shareToken, title }: {
  config: object; brandColor: string; shareToken: string; title?: string;
}) {
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showChart, setShowChart] = useState(false);

  const html = useMemo(() => showChart ? `<!DOCTYPE html>
<html><head><script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script>
<style>html,body{margin:0;padding:16px;background:transparent!important;display:flex;justify-content:center;align-items:center;min-height:100%;font-family:system-ui;box-sizing:border-box}canvas{width:100%!important;max-height:260px;background:transparent!important}</style>
</head><body><canvas id="c"></canvas>
<script>new Chart(document.getElementById('c'),${JSON.stringify(config)})<\/script>
</body></html>` : "", [config, showChart]);

  const reExplain = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_token: shareToken,
          messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: `Explain this data visualization in 2-3 sentences. The chart shows: ${title || "data from the proposal"}. What are the key takeaways?` }], createdAt: new Date() }],
        }),
      });
      if (!res.ok) { setAiResult("Unable to explain."); return; }
      const reader = res.body?.getReader(); if (!reader) return;
      const decoder = new TextDecoder(); let text = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          for (const p of ["0:", "g:"]) { if (line.startsWith(p)) { try { const v = JSON.parse(line.slice(p.length)); if (typeof v === "string") text += v; } catch {} } }
        }
      }
      setAiResult(text || "No explanation generated.");
    } catch { setAiResult("Failed to get explanation."); }
    finally { setLoading(false); }
  }, [shareToken, title]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isDark } = usePortalTheme();

  if (!showChart) {
    return (
      <button onClick={() => setShowChart(true)}
        className={cn("mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-colors",
          isDark ? "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white/60"
            : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700")}>
        <BarChart3 className="h-3 w-3" /> Show chart
      </button>
    );
  }

  return (
    <div className={cn("group relative rounded-2xl border overflow-hidden",
      isDark ? "border-white/[0.06] bg-white/[0.015]" : "border-gray-200 bg-white")}>
      <iframe srcDoc={html} className="h-[280px] w-full border-0 bg-transparent" sandbox="allow-scripts" title={title || "Chart"} />
      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={reExplain} disabled={loading}
          className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium backdrop-blur-xl transition-all disabled:opacity-50",
            isDark ? "border-white/10 bg-black/80 text-white/60 hover:bg-black/90 hover:text-white"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
          {loading ? "Thinking..." : "Explain this"}
        </button>
      </div>
      {aiResult && (
        <div className={cn("border-t px-4 py-3 text-xs leading-relaxed",
          isDark ? "border-white/[0.06] text-white/50" : "border-gray-200 text-gray-600")}>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 font-medium" style={{ color: brandColor }}><Sparkles className="h-3 w-3" /> AI Insight</span>
            <button onClick={() => setAiResult(null)} className={isDark ? "text-white/30 hover:text-white/60" : "text-gray-400 hover:text-gray-600"}><X className="h-3 w-3" /></button>
          </div>
          {aiResult}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Renderers
// ---------------------------------------------------------------------------

function HeroSection({ title, clientName, brandColor, logoUrl, subtitle }: {
  title: string; clientName: string; brandColor: string; logoUrl: string | null; subtitle: string | null;
}) {
  const { isDark } = usePortalTheme();
  return (
    <div className="relative flex min-h-[85vh] flex-col items-center justify-center px-6 py-24">
      {/* Animated gradient background + global section animations */}
      <style>{`
        @keyframes section-fade-in {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes card-scale-in {
          0% { opacity: 0; transform: scale(0.95) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-section { animation: section-fade-in 0.6s ease-out both; }
        .animate-card { animation: card-scale-in 0.5s ease-out both; }
        @keyframes hero-glow {
          0%, 100% { opacity: 0.12; transform: scale(1) translate(0, 0); }
          33% { opacity: 0.22; transform: scale(1.1) translate(2%, -3%); }
          66% { opacity: 0.16; transform: scale(0.95) translate(-2%, 2%); }
        }
        @keyframes hero-grid-drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }
        @keyframes hero-title-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes hero-fade-up {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-fade-up-delayed {
          0%, 30% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-scale-in {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes gradient-swirl-1 {
          0% { transform: rotate(0deg) scale(1); }
          33% { transform: rotate(120deg) scale(1.1); }
          66% { transform: rotate(240deg) scale(0.95); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes gradient-swirl-2 {
          0% { transform: rotate(0deg) scale(1.05); }
          50% { transform: rotate(-180deg) scale(0.9); }
          100% { transform: rotate(-360deg) scale(1.05); }
        }
        @keyframes gradient-swirl-3 {
          0% { transform: rotate(60deg) scale(0.95); }
          40% { transform: rotate(200deg) scale(1.15); }
          100% { transform: rotate(420deg) scale(0.95); }
        }
      `}</style>

      {/* Animated gradient mesh — multiple rotating blurred ellipses */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 h-[150%] w-[150%]"
          style={{
            background: `radial-gradient(ellipse 50% 40% at 40% 40%, ${brandColor}${isDark ? "18" : "12"} 0%, transparent 70%)`,
            animation: "gradient-swirl-1 25s ease-in-out infinite",
            filter: "blur(60px)",
          }} />
        <div className="absolute -top-1/4 -right-1/4 h-[150%] w-[150%]"
          style={{
            background: `radial-gradient(ellipse 45% 35% at 60% 55%, ${brandColor}${isDark ? "14" : "0a"} 0%, transparent 65%)`,
            animation: "gradient-swirl-2 30s ease-in-out infinite",
            filter: "blur(80px)",
          }} />
        <div className="absolute -bottom-1/4 left-1/4 h-[120%] w-[120%]"
          style={{
            background: `radial-gradient(ellipse 40% 50% at 50% 50%, ${brandColor}${isDark ? "10" : "08"} 0%, transparent 60%)`,
            animation: "gradient-swirl-3 35s ease-in-out infinite",
            filter: "blur(70px)",
          }} />
      </div>

      {/* Animated radial glow — pulses and drifts */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 90% 70% at 50% 40%, ${brandColor}${isDark ? "20" : "0c"} 0%, transparent 65%)`,
        animation: "hero-glow 8s ease-in-out infinite",
      }} />
      {/* Second glow layer offset */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 50% 40% at 60% 50%, ${brandColor}${isDark ? "10" : "06"} 0%, transparent 60%)`,
        animation: "hero-glow 12s ease-in-out infinite reverse",
      }} />
      {/* Animated grid — drifts diagonally (hidden in light mode) */}
      {isDark && (
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(${brandColor}60 1px, transparent 1px), linear-gradient(90deg, ${brandColor}60 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          animation: "hero-grid-drift 20s linear infinite",
        }} />
      )}
      {/* Bottom edge glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{
        background: `linear-gradient(90deg, transparent 10%, ${brandColor}50, transparent 90%)`,
      }} />

      {/* Gradient fade-out below hero — transitions into page background */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" style={{
        background: isDark
          ? "linear-gradient(to bottom, transparent, #050508)"
          : "linear-gradient(to bottom, transparent, #ffffff)",
      }} />

      <div className="relative z-10 flex max-w-5xl flex-col items-center gap-8 text-center">
        {/* Logo — scale in */}
        {logoUrl && (
          <img src={logoUrl} alt={clientName} className="h-14 w-auto"
            style={{ animation: "hero-scale-in 0.8s ease-out both" }} />
        )}

        {/* Badge — fade up */}
        <div className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-[10px] font-medium tracking-[0.2em] uppercase"
          style={{
            borderColor: `${brandColor}30`, color: brandColor, backgroundColor: `${brandColor}06`,
            animation: "hero-fade-up 0.8s ease-out 0.2s both",
          }}>
          <Sparkles className="h-3 w-3" /> Interactive Experience
        </div>

        {/* Title — BIG, animated gradient */}
        <h1 className={cn("text-6xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl", !isDark && "text-gray-900")}
          style={isDark ? {
            background: `linear-gradient(135deg, #ffffff 0%, ${brandColor} 40%, #ffffff 60%, ${brandColor} 100%)`,
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "hero-title-gradient 6s ease-in-out infinite, hero-fade-up 1s ease-out 0.4s both",
          } : {
            animation: "hero-fade-up 1s ease-out 0.4s both",
          }}>
          {title.replace(/Scope of Work —\s*/i, "").replace(/Proposal —\s*/i, "")}
        </h1>

        {/* Subtitle */}
        <p className={cn("max-w-xl text-lg", isDark ? "text-white/40" : "text-gray-500")}
          style={{ animation: "hero-fade-up-delayed 1.2s ease-out 0.5s both" }}>
          {subtitle || `Prepared for ${clientName}`}
        </p>

        {/* Scroll indicator */}
        <div style={{ animation: "hero-fade-up-delayed 1.5s ease-out 0.8s both" }}>
          <ChevronDown className="mt-8 h-6 w-6 animate-bounce" style={{ color: `${brandColor}50` }} />
        </div>
      </div>
    </div>
  );
}

function HeadingSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const lv = section.level ?? 1;
  return (
    <div ref={ref} id={section.id} className={cn(
      "scroll-mt-20 transition-all duration-600",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      lv === 1 && "mb-6 mt-24",
      lv === 2 && "mb-5 mt-16",
      lv >= 3 && "mb-4 mt-10",
    )}>
      {lv === 1 && (
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${brandColor}30, transparent)` }} />
          <img src="/bluewave-icon.svg" alt="" className="h-7 w-7 opacity-70" />
          <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${brandColor}30, transparent)` }} />
        </div>
      )}
      {lv === 1 ? (
        <h2 className={cn("text-center text-3xl font-bold tracking-tight sm:text-4xl", isDark ? "text-white" : "text-gray-900")}>{section.title}</h2>
      ) : lv === 2 ? (
        <h3 className={cn("text-2xl font-semibold", isDark ? "text-white/90" : "text-gray-800")}>{section.title}</h3>
      ) : (
        <h4 className={cn("text-sm font-semibold tracking-wider uppercase", !isDark && "text-teal-700")} style={isDark ? { color: `${brandColor}bb` } : undefined}>{section.title}</h4>
      )}
    </div>
  );
}

function ParagraphSection({ section, brandColor }: { section: DocSection; brandColor?: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const isLong = section.content.length > 200;

  // Detect Priority: pattern in paragraph text for inline badges
  const priorityMatch = section.content.match(/Priority:\s*(Must|Should|Could|Deferred|Won't)/i);

  return (
    <div ref={ref} className={cn("my-4 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      {isLong ? (
        <GlassCard className="p-6" brandColor={brandColor}>
          {priorityMatch && <div className="mb-3"><PriorityBadge priority={priorityMatch[1]} /></div>}
          <p className={cn("text-[15px] leading-[1.8]", isDark ? "text-white/55" : "text-gray-600")}>{section.content}</p>
        </GlassCard>
      ) : (
        <div>
          {priorityMatch && <div className="mb-2"><PriorityBadge priority={priorityMatch[1]} /></div>}
          <p className={cn("text-[15px] leading-[1.8]", isDark ? "text-white/55" : "text-gray-600")}>{section.content}</p>
        </div>
      )}
    </div>
  );
}

function ListSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { isDark } = usePortalTheme();
  const items = section.items ?? [];
  const isLong = items.some(it => it.length > 150);
  const hasPriority = items.some(it => /Priority:\s*(Must|Should|Could)/i.test(it));

  // Short lists (< 8 items, short text) → compact bullet list, no cards
  const useCompact = !isLong && !hasPriority && items.length <= 12;

  if (useCompact) {
    return (
      <ul className="my-5 space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: brandColor }} />
            <span className={cn("text-[15px] leading-[1.7]", isDark ? "text-white/60" : "text-gray-700")}>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("my-6", !isLong && !hasPriority && "grid gap-2.5 sm:grid-cols-2")}>
      {items.map((item, i) => {
        const priMatch = item.match(/Priority:\s*(Must|Should|Could|Deferred)/i);
        return (
          <div key={i}
            className={cn(
              "group flex items-start gap-3 rounded-lg border px-4 py-3",
              isDark
                ? "border-white/[0.05] bg-white/[0.01]"
                : "border-gray-200 bg-gray-50/50",
            )}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brandColor }} />
            <div className="flex-1 min-w-0">
              {priMatch && <div className="mb-1"><PriorityBadge priority={priMatch[1]} /></div>}
              <span className={cn("text-[15px] leading-[1.7]", isDark ? "text-white/60" : "text-gray-700")}>{item}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: Comparison Table (Current State -> Target State)
// ---------------------------------------------------------------------------

function ComparisonSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const comparisons = section.comparisons ?? [];

  return (
    <div ref={ref} className={cn("my-8 space-y-4 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      {comparisons.map((comp, i) => (
        <div
          key={i}
          className={cn("group relative overflow-hidden rounded-2xl border transition-all duration-500",
            isDark ? "border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1]" : "border-gray-200 bg-white hover:border-gray-300 shadow-sm")}
          style={{
            transitionDelay: isVisible ? `${i * 120}ms` : "0ms",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(12px)",
          }}
        >
          {/* Label bar */}
          <div className={cn("border-b px-6 py-3", isDark ? "border-white/[0.04]" : "border-gray-100")}>
            <span className={cn("text-[15px] font-semibold", isDark ? "text-white/80" : "text-gray-900")}>{comp.label}</span>
          </div>

          {/* Before -> After cards */}
          <div className="grid grid-cols-[1fr,auto,1fr] items-stretch gap-0">
            {/* Current State */}
            <div className="p-6">
              <div className={cn("mb-2 text-[10px] font-semibold uppercase tracking-widest", isDark ? "text-white/25" : "text-gray-400")}>Current State</div>
              <p className={cn("text-[16px] leading-relaxed", isDark ? "text-white/40" : "text-gray-600")}>{comp.current}</p>
            </div>

            {/* Arrow transition */}
            <div className="flex flex-col items-center justify-center px-2">
              <div className="h-full w-px" style={{ background: `linear-gradient(180deg, transparent, ${brandColor}20, transparent)` }} />
              <div
                className="my-2 flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}30` }}
              >
                <ArrowRight className="h-3.5 w-3.5" style={{ color: brandColor }} />
              </div>
              <div className="h-full w-px" style={{ background: `linear-gradient(180deg, transparent, ${brandColor}20, transparent)` }} />
            </div>

            {/* Target State */}
            <div className="p-6" style={{ background: `linear-gradient(135deg, ${brandColor}06 0%, transparent 60%)` }}>
              <div className={cn("mb-2 text-[10px] font-semibold uppercase tracking-widest", !isDark && "text-teal-600")} style={isDark ? { color: `${brandColor}80` } : undefined}>Target State</div>
              <p className={cn("text-[16px] leading-relaxed font-medium", !isDark && "text-teal-700")} style={isDark ? { color: `${brandColor}cc` } : undefined}>{comp.target}</p>
            </div>
          </div>

          {/* Bottom glow line on hover */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: `linear-gradient(90deg, transparent, ${brandColor}40, transparent)` }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: Architecture Diagram
// ---------------------------------------------------------------------------

function ArchitectureDiagram({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const layers = section.architectureLayers ?? [];

  // Alternate colors for visual layer separation
  const layerColors = isDark ? [
    { bg: `${brandColor}08`, border: `${brandColor}25`, accent: brandColor },
    { bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.08)", accent: "rgba(255,255,255,0.5)" },
    { bg: `${brandColor}05`, border: `${brandColor}18`, accent: `${brandColor}aa` },
  ] : [
    { bg: `${brandColor}06`, border: `${brandColor}20`, accent: brandColor },
    { bg: "rgb(249,250,251)", border: "rgb(229,231,235)", accent: "rgb(107,114,128)" },
    { bg: `${brandColor}04`, border: `${brandColor}15`, accent: `${brandColor}aa` },
  ];

  return (
    <div ref={ref} className={cn("my-10 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="relative space-y-0">
        {layers.map((layer, i) => {
          const colors = layerColors[i % layerColors.length];
          const isFirst = i === 0;
          const isLast = i === layers.length - 1;
          return (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden border border-b-0 last:border-b transition-all duration-500",
                isFirst && "rounded-t-2xl",
                isLast && "rounded-b-2xl border-b",
              )}
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
                transitionDelay: isVisible ? `${i * 200}ms` : "0ms",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(12px)",
              }}
            >
              {/* Layer content */}
              <div className="relative z-10 flex items-start gap-6 px-6 py-6 sm:px-8">
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl border"
                    style={{ borderColor: colors.border, backgroundColor: `${colors.bg}` }}
                  >
                    <Layers className="h-4.5 w-4.5" style={{ color: colors.accent }} />
                  </div>
                  {!isLast && (
                    <div className="h-4 w-px" style={{ backgroundColor: colors.border }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn("text-base font-bold", isDark ? "text-white" : "text-gray-900")}>{layer.layer}</span>
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
                      style={{ borderColor: colors.border, color: colors.accent, backgroundColor: colors.bg }}
                    >
                      {layer.owner}
                    </span>
                  </div>
                  <p className={cn("text-[16px] leading-relaxed", isDark ? "text-white/45" : "text-gray-500")}>{layer.contains}</p>
                </div>
              </div>

              {/* Subtle gradient overlay */}
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{ background: `linear-gradient(135deg, transparent 40%, ${colors.bg})` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: JTBD Cards
// ---------------------------------------------------------------------------

function JtbdSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const items = section.jtbdItems ?? [];

  return (
    <div ref={ref} className={cn("my-8 space-y-4 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      {items.map((jtbd, i) => (
        <div
          key={i}
          className={cn("group overflow-hidden rounded-2xl border transition-all duration-300",
            isDark ? "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1]"
              : "border-gray-200 bg-white hover:border-gray-300 shadow-sm")}
          style={{
            transitionDelay: isVisible ? `${i * 100}ms` : "0ms",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <div className="grid gap-0 sm:grid-cols-3">
            {/* When — context */}
            <div className={cn("border-b p-5 sm:border-b-0 sm:border-r", isDark ? "border-white/[0.04]" : "border-gray-100")}>
              <div className={cn("mb-2 text-[10px] font-semibold uppercase tracking-widest", isDark ? "text-amber-400/60" : "text-amber-600")}>When</div>
              <p className={cn("text-[15px] leading-relaxed", isDark ? "text-white/50" : "text-gray-700")}>{jtbd.when}</p>
            </div>
            {/* I want — action */}
            <div className={cn("border-b p-5 sm:border-b-0 sm:border-r", isDark ? "border-white/[0.04]" : "border-gray-100")} style={{ backgroundColor: `${brandColor}04` }}>
              <div className={cn("mb-2 text-[10px] font-semibold uppercase tracking-widest", !isDark && "text-teal-600")} style={isDark ? { color: `${brandColor}80` } : undefined}>I want</div>
              <p className={cn("text-[15px] leading-relaxed font-medium", !isDark && "text-teal-700")} style={isDark ? { color: `${brandColor}bb` } : undefined}>{jtbd.want}</p>
            </div>
            {/* So that — outcome */}
            <div className="p-5">
              <div className={cn("mb-2 text-[10px] font-semibold uppercase tracking-widest", isDark ? "text-emerald-400/60" : "text-emerald-600")}>So that</div>
              <p className={cn("text-[15px] leading-relaxed", isDark ? "text-emerald-400/70" : "text-emerald-700")}>{jtbd.soThat}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: Feature Spec Cards
// ---------------------------------------------------------------------------

function FeatureSpecSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const specs = section.featureSpecs ?? [];

  return (
    <div ref={ref} className={cn("my-6 space-y-4 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      {specs.map((spec, i) => (
        <GlassCard
          key={i}
          className="group overflow-hidden p-0"
          brandColor={brandColor}
          glowOnHover
          style={{
            transitionDelay: isVisible ? `${i * 100}ms` : "0ms",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(10px)",
          }}
        >
          {/* Header */}
          <div className={cn("flex items-center justify-between border-b px-6 py-4", isDark ? "border-white/[0.04]" : "border-gray-200")}>
            <span className={cn("text-[15px] font-semibold", isDark ? "text-white" : "text-gray-900")}>{spec.name}</span>
            <PriorityBadge priority={spec.priority} />
          </div>
          {/* Description */}
          <div className="px-6 py-4">
            <p className={cn("text-[16px] leading-[1.75]", isDark ? "text-white/50" : "text-gray-600")}>{spec.description}</p>
          </div>
          {/* Acceptance Criteria */}
          {spec.acceptance.length > 0 && (
            <div className={cn("border-t px-6 py-4", isDark ? "border-white/[0.04]" : "border-gray-200")} style={{ backgroundColor: `${brandColor}03` }}>
              <div className={cn("mb-3 text-[10px] font-semibold uppercase tracking-widest", isDark ? "text-white/25" : "text-gray-400")}>Acceptance Criteria</div>
              <div className="space-y-2">
                {spec.acceptance.map((ac, ai) => (
                  <div key={ai} className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                      style={{ borderColor: `${brandColor}30`, backgroundColor: `${brandColor}08` }}
                    >
                      <Check className="h-2.5 w-2.5" style={{ color: `${brandColor}90` }} />
                    </div>
                    <span className={cn("text-[15px] leading-relaxed", isDark ? "text-white/45" : "text-gray-500")}>{ac}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: Acceptance Criteria list
// ---------------------------------------------------------------------------

function AcceptanceCriteriaSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const items = section.items ?? [];

  return (
    <div ref={ref} className={cn("my-6 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      <GlassCard className="p-6" brandColor={brandColor}>
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 transition-all duration-300"
              style={{
                transitionDelay: isVisible ? `${i * 60}ms` : "0ms",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-8px)",
              }}
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-300"
                style={{ borderColor: `${brandColor}35`, backgroundColor: `${brandColor}10` }}
              >
                <Check className="h-3 w-3" style={{ color: `${brandColor}` }} />
              </div>
              <span className={cn("text-[15px] leading-relaxed", isDark ? "text-white/50" : "text-gray-500")}>{item}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: Priority Matrix
// ---------------------------------------------------------------------------

function PriorityMatrixSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const { isDark } = usePortalTheme();
  const rows = section.priorityRows ?? [];

  return (
    <div ref={ref} className={cn("my-8 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className={cn("overflow-hidden rounded-2xl border", isDark ? "border-white/[0.06]" : "border-gray-200")}>
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr style={{ backgroundColor: `${brandColor}06` }}>
                <th className={cn("px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-white/50" : "text-gray-600")}>Feature Group</th>
                <th className={cn("px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-emerald-400/60" : "text-emerald-600")}>Must</th>
                <th className={cn("px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-amber-400/60" : "text-amber-600")}>Should</th>
                <th className={cn("px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-400")}>Could</th>
                <th className={cn("px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-red-400/40" : "text-red-500")}>Deferred</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn("border-t transition-colors", isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50")}
                  style={{
                    transitionDelay: isVisible ? `${ri * 60}ms` : "0ms",
                    opacity: isVisible ? 1 : 0,
                  }}
                >
                  <td className={cn("px-5 py-4 font-medium", isDark ? "text-white/70" : "text-gray-700")}>{row.feature}</td>
                  <td className="px-5 py-4 text-center">{row.must ? <span className={cn("inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[12px]", isDark ? "text-emerald-400" : "text-emerald-600")}>{row.must}</span> : <span className={isDark ? "text-white/10" : "text-gray-300"}>-</span>}</td>
                  <td className="px-5 py-4 text-center">{row.should ? <span className={cn("inline-block rounded-md bg-amber-500/15 px-2 py-0.5 text-[12px]", isDark ? "text-amber-400" : "text-amber-600")}>{row.should}</span> : <span className={isDark ? "text-white/10" : "text-gray-300"}>-</span>}</td>
                  <td className="px-5 py-4 text-center">{row.could ? <span className={cn("inline-block rounded-md px-2 py-0.5 text-[12px]", isDark ? "bg-white/[0.05] text-white/40" : "bg-gray-100 text-gray-500")}>{row.could}</span> : <span className={isDark ? "text-white/10" : "text-gray-300"}>-</span>}</td>
                  <td className="px-5 py-4 text-center">{row.deferred ? <span className={cn("inline-block rounded-md bg-red-500/10 px-2 py-0.5 text-[12px]", isDark ? "text-red-400/60" : "text-red-500")}>{row.deferred}</span> : <span className={isDark ? "text-white/10" : "text-gray-300"}>-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Existing renderers (improved)
// ---------------------------------------------------------------------------

function DataTableSection({ section, brandColor, shareToken }: { section: DocSection; brandColor: string; shareToken: string }) {
  const { isDark } = usePortalTheme();
  const headers = section.tableHeaders ?? [];
  const rows = section.tableRows ?? [];

  const numericCol = headers.findIndex((_, ci) => rows.filter(r => /[\d.]+/.test(r[ci]?.replace(/[$,~%<>]/g, "") ?? "")).length >= 2);
  const labelCol = 0;
  const chartConfig = useMemo(() => {
    if (numericCol < 0 || numericCol === labelCol || rows.length < 2) return null;
    const labels = rows.map(r => r[labelCol]?.slice(0, 30) ?? "");
    const values = rows.map(r => parseFloat((r[numericCol] ?? "0").replace(/[$,~%<>]/g, "")) || 0);
    if (values.every(v => v === 0)) return null;
    const colors = rows.map((_, i) => `${brandColor}${Math.round(((i + 1) / rows.length) * 180 + 75).toString(16).padStart(2, "0")}`);
    const textColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.6)";
    const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";
    return {
      type: rows.length <= 5 ? "doughnut" : "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "transparent", borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: true, animation: { duration: 1000 },
        plugins: { legend: { position: "right" as const, labels: { color: textColor, font: { size: 10 } } } },
        ...(rows.length > 5 ? { scales: { x: { ticks: { color: textColor }, grid: { color: gridColor } }, y: { ticks: { color: textColor }, grid: { color: gridColor } } } } : {}),
      },
    };
  }, [headers, rows, numericCol, brandColor, isDark]);

  return (
    <div className="my-8 animate-section">
      <div className={cn("overflow-hidden rounded-2xl border", isDark ? "border-white/[0.06]" : "border-gray-200")}>
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead><tr style={{ backgroundColor: `${brandColor}08` }}>
              {headers.map((h, hi) => <th key={hi} className={cn("px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-white/50" : "text-gray-600")}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((row, ri) => (
              <tr key={ri} className={cn("border-t transition-colors", isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50")}>
                {row.map((cell, ci) => <td key={ci} className={cn("px-5 py-4", ci === 0 ? (isDark ? "font-medium text-white/70" : "font-medium text-gray-700") : (isDark ? "text-white/50" : "text-gray-500"))}>{cell}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {chartConfig && (
        <div className="mt-5">
          <InteractiveChart config={chartConfig} brandColor={brandColor} shareToken={shareToken} title={headers.join(" / ")} />
        </div>
      )}
    </div>
  );
}

function PhaseTimelineCard({ phase, brandColor, icon: Icon }: {
  phase: { name: string; timeline: string; description: string };
  brandColor: string;
  icon: React.ElementType;
}) {
  const { isDark } = usePortalTheme();
  const [expanded, setExpanded] = useState(false);

  // Split description into sub-items by sentence boundaries that look like labeled items
  const parts = phase.description.split(/(?<=\.) (?=[A-Z])/);
  const summary = parts[0] ?? phase.description.slice(0, 120);
  const hasMore = parts.length > 1 || phase.description.length > 150;

  return (
    <GlassCard className="p-5 group" brandColor={brandColor} glowOnHover>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${brandColor}15` }}>
          <Icon className="h-4 w-4" style={{ color: brandColor }} />
        </div>
        <div>
          <div className={cn("text-lg font-bold", isDark ? "text-white" : "text-gray-900")}>{phase.name}</div>
          <div className={cn("flex items-center gap-1.5 text-[13px]", !isDark && "text-teal-700")} style={isDark ? { color: `${brandColor}bb` } : undefined}>
            <Clock className="h-3 w-3" />{phase.timeline}
          </div>
        </div>
      </div>

      <p className={cn("text-[15px] leading-[1.7] mt-3", isDark ? "text-white/55" : "text-gray-600")}>
        {expanded ? summary : summary.slice(0, 120) + (summary.length > 120 ? "..." : "")}
      </p>

      {hasMore && expanded && parts.length > 1 && (
        <ul className="mt-3 space-y-2">
          {parts.slice(1).map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: brandColor }} />
              <span className={cn("text-[15px] leading-[1.6]", isDark ? "text-white/50" : "text-gray-500")}>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button onClick={() => setExpanded(!expanded)}
          className={cn("mt-3 text-[13px] font-medium transition-colors", isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600")}
          style={{ color: expanded ? brandColor : undefined }}>
          {expanded ? "Show less" : `Show ${parts.length - 1} more details`}
        </button>
      )}
    </GlassCard>
  );
}

function PhaseTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { isDark } = usePortalTheme();
  const phases = section.phases ?? [];
  const icons = [Target, Zap, Sparkles, BarChart3];
  return (
    <div className="my-12">
      {/* Horizontal phase cards — cleaner than alternating timeline */}
      <div className="space-y-6">
        {phases.map((phase, i) => {
          const Icon = icons[i % icons.length];
          return (
            <div key={i} className="flex gap-4 items-start">
              {/* Vertical connector */}
              <div className="flex flex-col items-center gap-1 pt-2 shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold"
                  style={{ borderColor: brandColor, backgroundColor: `${brandColor}12`, color: brandColor }}>
                  {i + 1}
                </div>
                {i < phases.length - 1 && <div className="flex-1 w-px min-h-[40px]" style={{ backgroundColor: `${brandColor}20` }} />}
              </div>
              {/* Card */}
              <div className="flex-1 min-w-0">
                <PhaseTimelineCard phase={phase} brandColor={brandColor} icon={Icon} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetSection({ section, brandColor, shareToken }: { section: DocSection; brandColor: string; shareToken: string }) {
  const { isDark } = usePortalTheme();
  const rows = section.budgetRows ?? [];

  const chartConfig = useMemo(() => {
    const withNums = rows.filter(r => r.investment.includes("$"));
    if (withNums.length < 2) return null;
    const labels = withNums.map(r => r.phase.replace(/Phase \d+:\s*/i, "Ph " + (rows.indexOf(r) + 1)));
    const values = withNums.map(r => { const m = r.investment.match(/\$([\d,]+)/); return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0; });
    const colors = withNums.map((_, i) => `${brandColor}${Math.round(((i + 1) / withNums.length) * 160 + 95).toString(16).padStart(2, "0")}`);
    const tc = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.55)";
    const gc = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";
    return {
      type: "bar" as const,
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "transparent", borderRadius: 6, barPercentage: 0.6 }] },
      options: { responsive: true, maintainAspectRatio: true, animation: { duration: 1200 },
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: tc }, grid: { display: false } }, y: { ticks: { color: tc, callback: (v: number) => "$" + (v / 1000) + "k" }, grid: { color: gc } } },
      },
    };
  }, [rows, brandColor, isDark]);

  // Budget chart auto-shows (it's the key visual for this section)
  const [chartReady] = useState(true);

  return (
    <div className="my-10 animate-section">
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row, i) => (
          <div key={i} className={cn("animate-card group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300",
            isDark ? "border-white/[0.06] bg-white/[0.018] hover:border-white/[0.12] hover:bg-white/[0.03]"
              : "border-gray-200 bg-gray-50/80 hover:border-gray-300 hover:bg-gray-50 shadow-sm")}
            style={{ animationDelay: `${i * 0.1}s` }}>
            <p className={cn("mb-4 text-[10px] font-semibold uppercase tracking-widest", isDark ? "text-white/25" : "text-gray-400")}>{row.phase.length > 40 ? row.phase.slice(0, 40) + "..." : row.phase}</p>
            <p className={cn("mb-2 text-3xl font-bold", isDark ? "" : "text-gray-900")} style={isDark && row.investment.includes("$") ? { background: `linear-gradient(135deg, #fff 30%, ${brandColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : (!isDark && row.investment.includes("$") ? { color: brandColor } : {})}>
              {row.investment}
            </p>
            <div className={cn("flex items-center gap-1.5 text-[12px]", isDark ? "text-white/35" : "text-gray-400")}><Clock className="h-3 w-3" />{row.timeline}</div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}50, transparent)` }} />
          </div>
        ))}
      </div>
      {/* Budget chart auto-displays */}
      {chartConfig && chartReady && (
        <div className={cn("mt-5 animate-card overflow-hidden rounded-2xl border", isDark ? "border-white/[0.06] bg-white/[0.015]" : "border-gray-200 bg-white")} style={{ animationDelay: "0.3s" }}>
          <iframe srcDoc={`<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script>
<style>html,body{margin:0;padding:16px;background:transparent!important;display:flex;justify-content:center;align-items:center;min-height:100%;font-family:system-ui;box-sizing:border-box}canvas{width:100%!important;max-height:260px;background:transparent!important}</style>
</head><body><canvas id="c"></canvas>
<script>new Chart(document.getElementById('c'),${JSON.stringify(chartConfig)})<\/script>
</body></html>`} className="h-[280px] w-full border-0 bg-transparent" sandbox="allow-scripts" title="Budget chart" />
        </div>
      )}
    </div>
  );
}

function MilestoneTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { isDark } = usePortalTheme();
  const ms = section.milestones ?? [];
  return (
    <div className="my-10 space-y-4 animate-section">
      {ms.map((m, i) => (
        <div key={i} className={cn("animate-card group flex gap-4 rounded-2xl border p-5 transition-all duration-300",
          isDark ? "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.1] hover:bg-white/[0.025]"
            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 shadow-sm")}
          style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <div className="h-3 w-3 rounded-full border-2 transition-transform duration-300 group-hover:scale-125" style={{ borderColor: brandColor, backgroundColor: `${brandColor}35` }} />
            {i < ms.length - 1 && <div className="flex-1 w-px" style={{ backgroundColor: `${brandColor}18` }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={cn("text-[15px] font-semibold", isDark ? "text-white" : "text-gray-900")}>{m.phase}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", !isDark && "text-teal-700")} style={{ backgroundColor: `${brandColor}12`, ...(isDark ? { color: `${brandColor}cc` } : {}) }}>{m.dates}</span>
            </div>
            <p className={cn("text-[16px] leading-relaxed", isDark ? "text-white/40" : "text-gray-500")}>{m.milestones}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: Inbound Call Triage Flow Diagram
// ---------------------------------------------------------------------------

function InboundTriageFlow({ brandColor }: { brandColor: string }) {
  const { isDark } = usePortalTheme();
  return (
    <div className="my-10">
      <style>{`
        @keyframes flowNodeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes flowLineGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes flowLineGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .flow-node { animation: flowNodeIn 0.5s ease-out both; }
        .flow-line-v { animation: flowLineGrow 0.4s ease-out both; transform-origin: top; }
        .flow-line-h { animation: flowLineGrowX 0.4s ease-out both; transform-origin: left; }
      `}</style>

      <div className="flex flex-col items-center gap-0">
        {/* Node: Inbound Call */}
        <div
          className="flow-node flex items-center gap-3 rounded-2xl border px-6 py-4"
          style={{ animationDelay: "0s", borderColor: `${brandColor}30`, backgroundColor: `${brandColor}08` }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${brandColor}18` }}>
            <Phone className="h-5 w-5" style={{ color: brandColor }} />
          </div>
          <div>
            <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>Inbound Call</div>
            <div className={cn("text-[11px]", isDark ? "text-white/35" : "text-gray-400")}>Incoming phone call received</div>
          </div>
        </div>

        {/* Vertical connector */}
        <div className="flow-line-v h-8 w-px" style={{ animationDelay: "0.3s", backgroundColor: `${brandColor}30` }} />

        {/* Node: AI Receptionist */}
        <div
          className="flow-node flex items-center gap-3 rounded-2xl border px-6 py-4"
          style={{ animationDelay: "0.4s", borderColor: `${brandColor}40`, backgroundColor: `${brandColor}10` }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${brandColor}25` }}>
            <Sparkles className="h-5 w-5" style={{ color: brandColor }} />
          </div>
          <div>
            <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>AI Receptionist</div>
            <div className={cn("text-[11px]", isDark ? "text-white/35" : "text-gray-400")}>Intent gathering &amp; routing</div>
          </div>
        </div>

        {/* Vertical connector */}
        <div className="flow-line-v h-8 w-px" style={{ animationDelay: "0.7s", backgroundColor: `${brandColor}30` }} />

        {/* Branching: 3 paths */}
        <div className="flow-node flex items-center gap-4 sm:gap-6" style={{ animationDelay: "0.8s" }}>
          {[
            { icon: DollarSign, label: "Sales", desc: "Revenue inquiries" },
            { icon: Briefcase, label: "Admin / HR", desc: "Internal requests" },
            { icon: Users, label: "Candidates", desc: "Job applicants" },
          ].map((branch, bi) => (
            <div key={bi} className="flex flex-col items-center gap-0">
              <div className="flow-line-v h-4 w-px" style={{ animationDelay: `${0.9 + bi * 0.1}s`, backgroundColor: `${brandColor}25` }} />
              <div
                className="flow-node flex flex-col items-center gap-2 rounded-xl border px-4 py-3 text-center"
                style={{ animationDelay: `${1.0 + bi * 0.15}s`, borderColor: bi === 2 ? `${brandColor}40` : (isDark ? "rgba(255,255,255,0.06)" : "rgb(229,231,235)"), backgroundColor: bi === 2 ? `${brandColor}06` : (isDark ? "rgba(255,255,255,0.015)" : "rgb(249,250,251)") }}
              >
                <branch.icon className="h-4 w-4" style={{ color: bi === 2 ? brandColor : (isDark ? "rgba(255,255,255,0.45)" : "rgb(107,114,128)") }} />
                <div className={cn("text-[12px] font-semibold", isDark ? "text-white/80" : "text-gray-700")}>{branch.label}</div>
                <div className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-400")}>{branch.desc}</div>
              </div>
              {bi === 2 && <div className="flow-line-v h-6 w-px" style={{ animationDelay: "1.5s", backgroundColor: `${brandColor}30` }} />}
            </div>
          ))}
        </div>

        {/* Candidate path continues */}
        {/* Node: Recruiter Agent */}
        <div
          className="flow-node flex items-center gap-3 rounded-2xl border px-6 py-4"
          style={{ animationDelay: "1.6s", borderColor: `${brandColor}35`, backgroundColor: `${brandColor}08` }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${brandColor}18` }}>
            <SearchIcon className="h-5 w-5" style={{ color: brandColor }} />
          </div>
          <div>
            <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>Recruiter Agent</div>
            <div className={cn("text-[11px]", isDark ? "text-white/35" : "text-gray-400")}>Pre-screening &amp; evaluation</div>
          </div>
        </div>

        {/* Vertical connector */}
        <div className="flow-line-v h-8 w-px" style={{ animationDelay: "1.9s", backgroundColor: `${brandColor}30` }} />

        {/* Node: Progressive Ticketing */}
        <div
          className="flow-node flex items-center gap-3 rounded-2xl border px-6 py-4"
          style={{ animationDelay: "2.0s", borderColor: `${brandColor}30`, backgroundColor: `${brandColor}06` }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${brandColor}15` }}>
            <FileText className="h-5 w-5" style={{ color: brandColor }} />
          </div>
          <div>
            <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>Progressive Ticketing</div>
            <div className={cn("text-[11px]", isDark ? "text-white/35" : "text-gray-400")}>Contextual summaries &mdash; auto-shared</div>
          </div>
        </div>

        {/* Vertical connector */}
        <div className="flow-line-v h-8 w-px" style={{ animationDelay: "2.3s", backgroundColor: `${brandColor}30` }} />

        {/* Destination systems */}
        <div className="flow-node flex items-center gap-3 sm:gap-5" style={{ animationDelay: "2.4s" }}>
          {["Bullhorn", "RingCentral", "Slack"].map((sys, si) => (
            <div
              key={si}
              className="flow-node rounded-lg border px-4 py-2.5 text-center text-[12px] font-semibold"
              style={{
                animationDelay: `${2.5 + si * 0.12}s`,
                borderColor: `${brandColor}25`,
                backgroundColor: `${brandColor}06`,
                color: isDark ? `${brandColor}cc` : "#0891b2",
              }}
            >
              {sys}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: Outbound Candidate Screening Flow
// ---------------------------------------------------------------------------

function OutboundScreeningFlow({ brandColor }: { brandColor: string }) {
  const { isDark } = usePortalTheme();
  const steps = [
    { icon: Briefcase, label: "New Job Requisition", desc: "Via Bullhorn" },
    { icon: SearchIcon, label: "Screening Agent", desc: "Evaluate real criteria" },
    { icon: Users, label: "2,000+ Candidates", desc: "Contacted & screened" },
    { icon: Bell, label: "Recruiter Notified", desc: "Tear sheet + verification" },
    { icon: CheckCircle2, label: "Qualified Shortlist", desc: "Delivered to team" },
  ];

  return (
    <div className="my-10">
      <style>{`
        @keyframes screenStepIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes screenArrowIn { from { opacity: 0; transform: scaleX(0); } to { opacity: 1; transform: scaleX(1); } }
        .screen-step { animation: screenStepIn 0.45s ease-out both; }
        .screen-arrow { animation: screenArrowIn 0.35s ease-out both; transform-origin: left; }
      `}</style>

      {/* Time badge */}
      <div className="mb-6 flex justify-center">
        <div
          className="screen-step inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-bold"
          style={{ animationDelay: "0s", borderColor: `${brandColor}40`, backgroundColor: `${brandColor}10`, color: brandColor }}
        >
          <Zap className="h-3.5 w-3.5" />
          Under 1 Hour
        </div>
      </div>

      {/* Horizontal flow — all 5 steps in one row */}
      <div className="flex items-center justify-center gap-0 overflow-x-auto pb-2">
        {steps.map((step, si) => (
          <div key={si} className="flex items-center shrink-0">
            {/* Step card */}
            <div
              className="screen-step flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center"
              style={{
                animationDelay: `${0.2 + si * 0.25}s`,
                borderColor: si === steps.length - 1 ? `${brandColor}50` : `${brandColor}20`,
                backgroundColor: si === steps.length - 1 ? `${brandColor}12` : `${brandColor}05`,
                width: 140,
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: si === steps.length - 1 ? `${brandColor}25` : `${brandColor}15` }}
              >
                <step.icon className="h-5 w-5" style={{ color: brandColor }} />
              </div>
              <div className={cn("text-[12px] font-semibold", isDark ? "text-white/85" : "text-gray-700")}>{step.label}</div>
              <div className={cn("text-[10px]", isDark ? "text-white/35" : "text-gray-400")}>{step.desc}</div>
            </div>

            {/* Arrow connector (not after last) */}
            {si < steps.length - 1 && (
              <div
                className="screen-arrow mx-1 hidden sm:flex items-center"
                style={{ animationDelay: `${0.4 + si * 0.25}s` }}
              >
                <div className="h-px w-6" style={{ backgroundColor: `${brandColor}30` }} />
                <ArrowRight className="h-3.5 w-3.5 -ml-0.5" style={{ color: `${brandColor}60` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Experience
// ---------------------------------------------------------------------------

export function PortalExperience({ portal }: { portal: PortalData }) {
  const [chatOpen, setChatOpen] = useState(false);
  const docs = portal.documents ?? [];
  const defaultIdx = Math.max(0, docs.findIndex(d => d.is_active));
  const [activeDocIdx, setActiveDocIdx] = useState(defaultIdx);
  const brandColor = portal.brand_color || "#0DE4F2";
  const activeDoc = docs[activeDocIdx] ?? docs[0];
  const content = activeDoc?.content ?? portal.document_content ?? "";
  const sections = useMemo(() => parseDocument(content, activeDoc?.title ?? portal.title, portal.client_name ?? "Client"), [content, activeDoc?.title, portal.title, portal.client_name]);
  const tocEntries = useMemo(() => buildToc(sections), [sections]);
  const extraHeaders = useMemo(() => ({ "x-portal-token": portal.share_token }), [portal.share_token]);
  const handleDocSwitch = useCallback((idx: number) => { setActiveDocIdx(idx); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);

  // Theme state — persisted to localStorage, synced to <html> class for ChatInterface
  const [theme, setTheme] = useState<PortalTheme>("dark");
  useEffect(() => {
    const saved = localStorage.getItem("portal-theme") as PortalTheme | null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      if (saved === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Default is dark
      document.documentElement.classList.add("dark");
    }
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("portal-theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  }, []);
  const isDark = theme === "dark";
  const themeCtx = useMemo(() => ({ isDark, theme }), [isDark, theme]);

  return (
    <ThemeContext.Provider value={themeCtx}>
    <div className={cn("min-h-screen", isDark ? "bg-[#050508] text-white" : "bg-white text-gray-900")}>
      <FloatingToc entries={tocEntries} brandColor={brandColor} />

      {/* Nav */}
      <nav className={cn("fixed top-0 z-[45] flex w-full items-center justify-between border-b px-6 py-2.5 backdrop-blur-xl",
        isDark ? "border-white/[0.06] bg-[#050508]/80" : "border-gray-200 bg-white/95")}>
        <div className="flex items-center gap-2.5 pl-28">
          <img src="/bluewave-icon.svg" alt="" className="h-5 w-5 opacity-80" />
          <span className={cn("text-[11px]", isDark ? "text-white/30" : "text-gray-400")}>Prepared by <span className={isDark ? "text-white/50" : "text-gray-600"}>Mirror Factory</span></span>
        </div>
        <div className="flex items-center gap-2">
          {docs.length > 1 && (
            <div className={cn("flex items-center gap-0.5 rounded-lg border p-0.5",
              isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-gray-200 bg-gray-50")}>
              {docs.map((doc, di) => (
                <button key={di} onClick={() => handleDocSwitch(di)}
                  className={cn("cursor-pointer rounded-md px-2.5 py-1 text-[11px] transition-all",
                    di === activeDocIdx ? "font-medium" : (isDark ? "text-white/30 hover:text-white/55" : "text-gray-400 hover:text-gray-600"))}
                  style={di === activeDocIdx ? { backgroundColor: `${brandColor}18`, color: brandColor } : undefined}>
                  {doc.title.length > 18 ? doc.title.slice(0, 18) + "..." : doc.title}
                </button>
              ))}
            </div>
          )}
          {activeDoc?.pdf_path && (
            <Button variant="ghost" size="sm" asChild className={cn("h-7 gap-1 text-[11px]", isDark ? "text-white/35 hover:text-white/60" : "text-gray-400 hover:text-gray-600")}>
              <a href={activeDoc.pdf_path} download target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3" /> PDF</a>
            </Button>
          )}
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isDark ? "text-white/40 hover:text-white/70 hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100")}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <Button variant="outline" size="sm" onClick={() => setChatOpen(!chatOpen)}
            className={cn("h-7 gap-1.5 text-[11px]",
              isDark ? "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50")}>
            <MessageSquare className="h-3 w-3" /> {chatOpen ? "Close" : "Chat"}
          </Button>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 pt-14">
        {sections.map(section => {
          switch (section.type) {
            case "hero": return <HeroSection key={section.id} title={section.title ?? portal.title} clientName={section.content} brandColor={brandColor} logoUrl={portal.logo_url} subtitle={portal.subtitle} />;
            case "heading": return <HeadingSection key={section.id} section={section} brandColor={brandColor} />;
            case "paragraph": return <ParagraphSection key={section.id} section={section} brandColor={brandColor} />;
            case "list": return <ListSection key={section.id} section={section} brandColor={brandColor} />;
            case "data-table": return <DataTableSection key={section.id} section={section} brandColor={brandColor} shareToken={portal.share_token} />;
            case "phase-timeline": return <PhaseTimeline key={section.id} section={section} brandColor={brandColor} />;
            case "budget-table": return <BudgetSection key={section.id} section={section} brandColor={brandColor} shareToken={portal.share_token} />;
            case "milestone-timeline": return <MilestoneTimeline key={section.id} section={section} brandColor={brandColor} />;
            case "comparison-table": return <ComparisonSection key={section.id} section={section} brandColor={brandColor} />;
            case "architecture-diagram": return <ArchitectureDiagram key={section.id} section={section} brandColor={brandColor} />;
            case "jtbd-list": return <JtbdSection key={section.id} section={section} brandColor={brandColor} />;
            case "feature-spec": return <FeatureSpecSection key={section.id} section={section} brandColor={brandColor} />;
            case "acceptance-criteria": return <AcceptanceCriteriaSection key={section.id} section={section} brandColor={brandColor} />;
            case "priority-matrix": return <PriorityMatrixSection key={section.id} section={section} brandColor={brandColor} />;
            case "flow-diagram": return section.diagramType === "inbound-triage"
              ? <InboundTriageFlow key={section.id} brandColor={brandColor} />
              : section.diagramType === "outbound-screening"
              ? <OutboundScreeningFlow key={section.id} brandColor={brandColor} />
              : null;
            case "divider": return <div key={section.id} className="my-16"><div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}15, transparent)` }} /></div>;
            default: return null;
          }
        })}
        <footer className="flex flex-col items-center gap-4 py-24">
          <div className="h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}25, transparent)` }} />
          {portal.logo_url && <img src={portal.logo_url} alt="" className="h-6 w-auto opacity-30" />}
          <p className={cn("text-[11px]", isDark ? "text-white/15" : "text-gray-300")}>Prepared by Mirror Factory</p>
        </footer>
      </main>

      {/* Chat — mobile: bottom sheet, desktop: floating panel */}
      {chatOpen && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 z-[55] bg-black/30 md:hidden" onClick={() => setChatOpen(false)} />

          {/* Chat container — responsive */}
          <div className={cn(
            "fixed z-[60] flex flex-col overflow-hidden border backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300",
            // Mobile: bottom sheet, full width, 60% height
            "inset-x-0 bottom-0 h-[65vh] rounded-t-2xl md:rounded-2xl",
            // Desktop: floating panel, fixed size
            "md:inset-auto md:bottom-4 md:right-4 md:w-[400px] md:h-[520px] md:max-h-[70vh]",
            isDark ? "border-white/[0.08] bg-[#0a0a0f]/95 shadow-2xl" : "border-gray-200 bg-white shadow-lg"
          )}>
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-2 pb-1 md:hidden">
              <div className={cn("h-1 w-10 rounded-full", isDark ? "bg-white/20" : "bg-gray-300")} />
            </div>

            <div className={cn("flex items-center justify-between border-b px-4 py-2.5 shrink-0",
              isDark ? "border-white/[0.06]" : "border-gray-200")}>
              <span className={cn("text-xs font-medium", isDark ? "text-white/60" : "text-gray-600")}>Ask about this proposal</span>
              <button onClick={() => setChatOpen(false)} className={isDark ? "text-white/30 hover:text-white/60" : "text-gray-400 hover:text-gray-600"}><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                apiEndpoint="/api/chat/portal"
                extraHeaders={extraHeaders}
                portalMode
                portalTitle={activeDoc?.title || portal.title}
                portalClientName={portal.client_name ?? undefined}
                portalBrandColor={brandColor}
                compactMode
                hideContextBar
                containerClassName={isDark ? undefined : "bg-white [&_.shrink-0]:!bg-white [&_.shrink-0.sticky]:!bg-white [&_.shrink-0.sticky]:!bg-none [&_textarea]:!bg-white [&_.bg-gradient-to-t]:!bg-none [&_.bg-gradient-to-t]:!bg-white [&_[style*='linear-gradient']]:!bg-white [&_[style*='linear-gradient']]:![background:white]"}
              />
            </div>
          </div>
        </>
      )}

      {/* Chat FAB */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
          style={{ backgroundColor: brandColor, boxShadow: `0 6px 24px ${brandColor}40` }}>
          <MessageSquare className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
    </ThemeContext.Provider>
  );
}
