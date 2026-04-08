"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ArrowRight, BarChart3, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight,
  Clock, DollarSign, Download, Layers, List, MessageSquare, Sparkles,
  Target, X, Zap, RefreshCw, Lightbulb, Loader2, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalData, PortalDocument } from "@/app/portal/[token]/page";
import { ChatInterface } from "@/components/chat-interface";

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
    | "priority-matrix";
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
}

interface TocEntry { id: string; title: string; level: number; }

// ---------------------------------------------------------------------------
// Parser Helpers
// ---------------------------------------------------------------------------

function cleanBold(s: string): string { return s.replace(/\*\*/g, "").replace(/\\\\/g, "").trim(); }

function parseMarkdownTable(lines: string[], startIdx: number): { headers: string[]; rows: string[][]; endIdx: number } {
  const headers = lines[startIdx].split("|").map(c => cleanBold(c.trim())).filter(Boolean);
  let j = startIdx + 1;
  if (j < lines.length && /^[|\s:-]+$/.test(lines[j].trim())) j++;
  const rows: string[][] = [];
  while (j < lines.length && lines[j].trim().startsWith("|")) {
    const cells = lines[j].split("|").map(c => cleanBold(c.trim())).filter(Boolean);
    if (cells.length > 0) rows.push(cells);
    j++;
  }
  return { headers, rows, endIdx: j };
}

// ---------------------------------------------------------------------------
// Document Parser
// ---------------------------------------------------------------------------

function parseDocument(content: string, portalTitle: string, clientName: string): DocSection[] {
  if (!content) return [];
  const lines = content.split("\n");
  const sections: DocSection[] = [];
  let idx = 0;

  sections.push({ id: "hero", type: "hero", title: portalTitle, content: clientName });

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i].trim();
    if (!raw) { i++; continue; }
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
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-white/[0.018] backdrop-blur-sm",
        "transition-all duration-300",
        glowOnHover && "hover:border-white/[0.12] hover:bg-white/[0.03]",
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
    ? { bg: "bg-white/[0.06]", text: "text-white/50", border: "border-white/[0.08]" }
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
        className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0a0a0f]/90 px-3 py-1.5 text-xs text-white/50 backdrop-blur-xl transition-all hover:bg-white/[0.05] hover:text-white/80">
        <BookOpen className="h-3.5 w-3.5" style={{ color: brandColor }} />
        Contents
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 max-h-[60vh] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0a0a0f]/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150">
          {entries.map(e => (
            <button key={e.id} onClick={() => { document.getElementById(e.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/50 transition-all hover:bg-white/[0.05] hover:text-white/80"
              style={{ paddingLeft: `${(e.level - 1) * 12 + 12}px` }}>
              <ChevronRight className="h-2.5 w-2.5 shrink-0" style={{ color: brandColor }} />
              <span className={cn("line-clamp-1", e.level === 1 && "font-medium text-white/60")}>{e.title}</span>
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
<style>body{margin:0;background:transparent;display:flex;justify-content:center;align-items:center;min-height:100%;font-family:system-ui}</style>
</head><body><canvas id="c" style="max-height:280px"></canvas>
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

  if (!showChart) {
    return (
      <button onClick={() => setShowChart(true)}
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/60">
        <BarChart3 className="h-3 w-3" /> Show chart
      </button>
    );
  }

  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
      <iframe srcDoc={html} className="h-[280px] w-full border-0 bg-transparent" sandbox="allow-scripts" title={title || "Chart"} />
      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={reExplain} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/80 px-2.5 py-1.5 text-[10px] font-medium text-white/60 backdrop-blur-xl transition-all hover:bg-black/90 hover:text-white disabled:opacity-50">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
          {loading ? "Thinking..." : "Explain this"}
        </button>
      </div>
      {aiResult && (
        <div className="border-t border-white/[0.06] px-4 py-3 text-xs leading-relaxed text-white/50">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 font-medium" style={{ color: brandColor }}><Sparkles className="h-3 w-3" /> AI Insight</span>
            <button onClick={() => setAiResult(null)} className="text-white/30 hover:text-white/60"><X className="h-3 w-3" /></button>
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
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div ref={ref} className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden px-6 py-20">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${brandColor}15 0%, transparent 70%)` }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(${brandColor}60 1px, transparent 1px), linear-gradient(90deg, ${brandColor}60 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />
      <div className={cn("relative z-10 flex max-w-4xl flex-col items-center gap-6 text-center transition-all duration-1000", isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0")}>
        {logoUrl && <img src={logoUrl} alt={clientName} className="h-12 w-auto opacity-90" />}
        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-medium tracking-widest uppercase" style={{ borderColor: `${brandColor}30`, color: brandColor, backgroundColor: `${brandColor}06` }}>
          <Sparkles className="h-3 w-3" /> Interactive Experience
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl" style={{ background: `linear-gradient(135deg, #fff 40%, ${brandColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {title.replace(/Scope of Work —\s*/i, "").replace(/Proposal —\s*/i, "")}
        </h1>
        <p className="max-w-xl text-base text-white/35">{subtitle || `Prepared for ${clientName}`}</p>
        <ChevronDown className="mt-6 h-5 w-5 animate-bounce" style={{ color: `${brandColor}40` }} />
      </div>
    </div>
  );
}

function HeadingSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
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
        <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">{section.title}</h2>
      ) : lv === 2 ? (
        <h3 className="text-2xl font-semibold text-white/90">{section.title}</h3>
      ) : (
        <h4 className="text-sm font-semibold tracking-wider uppercase" style={{ color: `${brandColor}bb` }}>{section.title}</h4>
      )}
    </div>
  );
}

function ParagraphSection({ section, brandColor }: { section: DocSection; brandColor?: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const isLong = section.content.length > 200;

  // Detect Priority: pattern in paragraph text for inline badges
  const priorityMatch = section.content.match(/Priority:\s*(Must|Should|Could|Deferred|Won't)/i);

  return (
    <div ref={ref} className={cn("my-4 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      {isLong ? (
        <GlassCard className="p-6" brandColor={brandColor}>
          {priorityMatch && <div className="mb-3"><PriorityBadge priority={priorityMatch[1]} /></div>}
          <p className="text-[15px] leading-[1.8] text-white/55">{section.content}</p>
        </GlassCard>
      ) : (
        <div>
          {priorityMatch && <div className="mb-2"><PriorityBadge priority={priorityMatch[1]} /></div>}
          <p className="text-[15px] leading-[1.8] text-white/55">{section.content}</p>
        </div>
      )}
    </div>
  );
}

function ListSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const items = section.items ?? [];
  const isLong = items.some(it => it.length > 120);

  // Detect if items contain "Priority: X" patterns
  const hasPriority = items.some(it => /Priority:\s*(Must|Should|Could)/i.test(it));

  return (
    <div ref={ref} className={cn(
      "my-6 transition-all duration-600",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      !isLong && !hasPriority && "grid gap-3 sm:grid-cols-2",
    )}>
      {items.map((item, i) => {
        const priMatch = item.match(/Priority:\s*(Must|Should|Could|Deferred)/i);
        return (
          <div key={i}
            className={cn(
              "group flex items-start gap-3.5 rounded-xl border border-white/[0.05] bg-white/[0.015] p-5",
              "transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.03]",
            )}
            style={{
              transitionDelay: isVisible ? `${i * 50}ms` : "0ms",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(8px)",
            }}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brandColor }} />
            <div className="flex-1 min-w-0">
              {priMatch && <div className="mb-1.5"><PriorityBadge priority={priMatch[1]} /></div>}
              <span className="text-[13px] leading-relaxed text-white/55">{item}</span>
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
  const comparisons = section.comparisons ?? [];

  return (
    <div ref={ref} className={cn("my-8 space-y-4 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      {comparisons.map((comp, i) => (
        <div
          key={i}
          className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.01] transition-all duration-500 hover:border-white/[0.1]"
          style={{
            transitionDelay: isVisible ? `${i * 120}ms` : "0ms",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(12px)",
          }}
        >
          {/* Label bar */}
          <div className="border-b border-white/[0.04] px-6 py-3">
            <span className="text-[13px] font-semibold text-white/80">{comp.label}</span>
          </div>

          {/* Before -> After cards */}
          <div className="grid grid-cols-[1fr,auto,1fr] items-stretch gap-0">
            {/* Current State */}
            <div className="p-6">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">Current State</div>
              <p className="text-[14px] leading-relaxed text-white/40">{comp.current}</p>
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
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: `${brandColor}80` }}>Target State</div>
              <p className="text-[14px] leading-relaxed font-medium" style={{ color: `${brandColor}cc` }}>{comp.target}</p>
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
  const layers = section.architectureLayers ?? [];

  // Alternate colors for visual layer separation
  const layerColors = [
    { bg: `${brandColor}08`, border: `${brandColor}25`, accent: brandColor },
    { bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.08)", accent: "rgba(255,255,255,0.5)" },
    { bg: `${brandColor}05`, border: `${brandColor}18`, accent: `${brandColor}aa` },
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
                    <span className="text-base font-bold text-white">{layer.layer}</span>
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
                      style={{ borderColor: colors.border, color: colors.accent, backgroundColor: colors.bg }}
                    >
                      {layer.owner}
                    </span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/45">{layer.contains}</p>
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
  const items = section.jtbdItems ?? [];

  return (
    <div ref={ref} className={cn("my-8 space-y-4 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      {items.map((jtbd, i) => (
        <div
          key={i}
          className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] transition-all duration-300 hover:border-white/[0.1]"
          style={{
            transitionDelay: isVisible ? `${i * 100}ms` : "0ms",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <div className="grid gap-0 sm:grid-cols-3">
            {/* When — context */}
            <div className="border-b border-white/[0.04] p-5 sm:border-b-0 sm:border-r">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-400/60">When</div>
              <p className="text-[13px] leading-relaxed text-white/50">{jtbd.when}</p>
            </div>
            {/* I want — action */}
            <div className="border-b border-white/[0.04] p-5 sm:border-b-0 sm:border-r" style={{ backgroundColor: `${brandColor}04` }}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: `${brandColor}80` }}>I want</div>
              <p className="text-[13px] leading-relaxed font-medium" style={{ color: `${brandColor}bb` }}>{jtbd.want}</p>
            </div>
            {/* So that — outcome */}
            <div className="p-5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-400/60">So that</div>
              <p className="text-[13px] leading-relaxed text-emerald-400/70">{jtbd.soThat}</p>
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
          <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
            <span className="text-[15px] font-semibold text-white">{spec.name}</span>
            <PriorityBadge priority={spec.priority} />
          </div>
          {/* Description */}
          <div className="px-6 py-4">
            <p className="text-[14px] leading-[1.75] text-white/50">{spec.description}</p>
          </div>
          {/* Acceptance Criteria */}
          {spec.acceptance.length > 0 && (
            <div className="border-t border-white/[0.04] px-6 py-4" style={{ backgroundColor: `${brandColor}03` }}>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Acceptance Criteria</div>
              <div className="space-y-2">
                {spec.acceptance.map((ac, ai) => (
                  <div key={ai} className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                      style={{ borderColor: `${brandColor}30`, backgroundColor: `${brandColor}08` }}
                    >
                      <Check className="h-2.5 w-2.5" style={{ color: `${brandColor}90` }} />
                    </div>
                    <span className="text-[13px] leading-relaxed text-white/45">{ac}</span>
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
              <span className="text-[13px] leading-relaxed text-white/50">{item}</span>
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
  const rows = section.priorityRows ?? [];

  return (
    <div ref={ref} className={cn("my-8 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ backgroundColor: `${brandColor}06` }}>
                <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">Feature Group</th>
                <th className="px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-400/60">Must</th>
                <th className="px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-amber-400/60">Should</th>
                <th className="px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-white/30">Could</th>
                <th className="px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-red-400/40">Deferred</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                  style={{
                    transitionDelay: isVisible ? `${ri * 60}ms` : "0ms",
                    opacity: isVisible ? 1 : 0,
                  }}
                >
                  <td className="px-5 py-4 font-medium text-white/70">{row.feature}</td>
                  <td className="px-5 py-4 text-center">{row.must ? <span className="inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[12px] text-emerald-400">{row.must}</span> : <span className="text-white/10">-</span>}</td>
                  <td className="px-5 py-4 text-center">{row.should ? <span className="inline-block rounded-md bg-amber-500/15 px-2 py-0.5 text-[12px] text-amber-400">{row.should}</span> : <span className="text-white/10">-</span>}</td>
                  <td className="px-5 py-4 text-center">{row.could ? <span className="inline-block rounded-md bg-white/[0.05] px-2 py-0.5 text-[12px] text-white/40">{row.could}</span> : <span className="text-white/10">-</span>}</td>
                  <td className="px-5 py-4 text-center">{row.deferred ? <span className="inline-block rounded-md bg-red-500/10 px-2 py-0.5 text-[12px] text-red-400/60">{row.deferred}</span> : <span className="text-white/10">-</span>}</td>
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
  const { ref, isVisible } = useScrollAnimation();
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
    return {
      type: rows.length <= 5 ? "doughnut" : "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "transparent", borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: true, animation: { duration: 1000 },
        plugins: { legend: { position: "right" as const, labels: { color: "rgba(255,255,255,0.5)", font: { size: 10 } } } },
        ...(rows.length > 5 ? { scales: { x: { ticks: { color: "rgba(255,255,255,0.35)" }, grid: { color: "rgba(255,255,255,0.04)" } }, y: { ticks: { color: "rgba(255,255,255,0.35)" }, grid: { color: "rgba(255,255,255,0.04)" } } } } : {}),
      },
    };
  }, [headers, rows, numericCol, brandColor]);

  return (
    <div ref={ref} className={cn("my-8 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr style={{ backgroundColor: `${brandColor}08` }}>
              {headers.map((h, hi) => <th key={hi} className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((row, ri) => (
              <tr key={ri} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                {row.map((cell, ci) => <td key={ci} className={cn("px-5 py-4", ci === 0 ? "font-medium text-white/70" : "text-white/50")}>{cell}</td>)}
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

function PhaseTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const phases = section.phases ?? [];
  const icons = [Target, Zap, Sparkles, BarChart3];
  return (
    <div ref={ref} className={cn("my-12 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="relative">
        {/* Connecting line with progress fill */}
        <div className="absolute left-7 top-0 bottom-0 w-[2px] sm:left-1/2 sm:-translate-x-px" style={{ background: `linear-gradient(180deg, transparent, ${brandColor}12, ${brandColor}12, transparent)` }} />
        <div
          className="absolute left-7 top-0 w-[2px] sm:left-1/2 sm:-translate-x-px transition-all duration-[2000ms] ease-out"
          style={{
            background: `linear-gradient(180deg, ${brandColor}60, ${brandColor}30, transparent)`,
            height: isVisible ? "100%" : "0%",
          }}
        />
        <div className="space-y-8">
          {phases.map((phase, i) => {
            const Icon = icons[i % icons.length];
            const isLeft = i % 2 === 0;
            return (
              <div key={i} className="relative transition-all duration-700" style={{ transitionDelay: isVisible ? `${i * 200}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(20px)" }}>
                {/* Timeline node */}
                <div className="absolute left-7 top-6 z-10 -translate-x-1/2 sm:left-1/2">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg transition-transform duration-300 hover:scale-110"
                    style={{ borderColor: brandColor, backgroundColor: `${brandColor}15`, boxShadow: `0 0 20px ${brandColor}20` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: brandColor }} />
                  </div>
                </div>

                {/* Card */}
                <div className={cn("ml-16 sm:ml-0 sm:w-[calc(50%-44px)]", isLeft ? "sm:mr-auto" : "sm:ml-auto")}>
                  <GlassCard className="p-6 group" brandColor={brandColor} glowOnHover>
                    <div className="mb-2 text-lg font-bold text-white">{phase.name}</div>
                    <div className="mb-4 flex items-center gap-2 text-[12px]" style={{ color: `${brandColor}cc` }}>
                      <Clock className="h-3.5 w-3.5" />
                      {phase.timeline}
                    </div>
                    <p className="text-[14px] leading-[1.75] text-white/45">{phase.description}</p>
                    {/* Bottom accent */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: `linear-gradient(90deg, transparent, ${brandColor}40, transparent)` }}
                    />
                  </GlassCard>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BudgetSection({ section, brandColor, shareToken }: { section: DocSection; brandColor: string; shareToken: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const rows = section.budgetRows ?? [];

  const chartConfig = useMemo(() => {
    const withNums = rows.filter(r => r.investment.includes("$"));
    if (withNums.length < 2) return null;
    const labels = withNums.map(r => r.phase.replace(/Phase \d+:\s*/i, "Ph " + (rows.indexOf(r) + 1)));
    const values = withNums.map(r => { const m = r.investment.match(/\$([\d,]+)/); return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0; });
    const colors = withNums.map((_, i) => `${brandColor}${Math.round(((i + 1) / withNums.length) * 160 + 95).toString(16).padStart(2, "0")}`);
    return {
      type: "bar" as const,
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "transparent", borderRadius: 6, barPercentage: 0.6 }] },
      options: { responsive: true, maintainAspectRatio: true, animation: { duration: 1200 },
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: "rgba(255,255,255,0.4)" }, grid: { display: false } }, y: { ticks: { color: "rgba(255,255,255,0.3)", callback: (v: number) => "$" + (v / 1000) + "k" }, grid: { color: "rgba(255,255,255,0.04)" } } },
      },
    };
  }, [rows, brandColor]);

  return (
    <div ref={ref} className={cn("my-10 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row, i) => (
          <div key={i} className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.018] p-6 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.03]"
            style={{ transitionDelay: isVisible ? `${i * 120}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "scale(1)" : "scale(0.96)" }}>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/25">{row.phase.length > 40 ? row.phase.slice(0, 40) + "..." : row.phase}</p>
            <p className="mb-2 text-3xl font-bold" style={row.investment.includes("$") ? { background: `linear-gradient(135deg, #fff 30%, ${brandColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : { color: "rgba(255,255,255,0.7)" }}>
              {row.investment}
            </p>
            <div className="flex items-center gap-1.5 text-[12px] text-white/35"><Clock className="h-3 w-3" />{row.timeline}</div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}50, transparent)` }} />
          </div>
        ))}
      </div>
      {chartConfig && <div className="mt-5"><InteractiveChart config={chartConfig} brandColor={brandColor} shareToken={shareToken} title="Budget by Phase" /></div>}
    </div>
  );
}

function MilestoneTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const ms = section.milestones ?? [];
  return (
    <div ref={ref} className={cn("my-10 space-y-4 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      {ms.map((m, i) => (
        <div key={i} className="group flex gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.025]"
          style={{ transitionDelay: isVisible ? `${i * 100}ms` : "0ms", opacity: isVisible ? 1 : 0 }}>
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <div className="h-3 w-3 rounded-full border-2 transition-transform duration-300 group-hover:scale-125" style={{ borderColor: brandColor, backgroundColor: `${brandColor}35` }} />
            {i < ms.length - 1 && <div className="flex-1 w-px" style={{ backgroundColor: `${brandColor}18` }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[15px] font-semibold text-white">{m.phase}</span>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${brandColor}12`, color: `${brandColor}cc` }}>{m.dates}</span>
            </div>
            <p className="text-[14px] text-white/40 leading-relaxed">{m.milestones}</p>
          </div>
        </div>
      ))}
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

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <FloatingToc entries={tocEntries} brandColor={brandColor} />

      {/* Nav */}
      <nav className="fixed top-0 z-[45] flex w-full items-center justify-between border-b border-white/[0.06] bg-[#050508]/80 px-6 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 pl-28">
          <img src="/bluewave-icon.svg" alt="" className="h-5 w-5 opacity-80" />
          <span className="text-[11px] text-white/30">Prepared by <span className="text-white/50">Mirror Factory</span></span>
        </div>
        <div className="flex items-center gap-2">
          {docs.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              {docs.map((doc, di) => (
                <button key={di} onClick={() => handleDocSwitch(di)}
                  className={cn("cursor-pointer rounded-md px-2.5 py-1 text-[11px] transition-all", di === activeDocIdx ? "font-medium" : "text-white/30 hover:text-white/55")}
                  style={di === activeDocIdx ? { backgroundColor: `${brandColor}18`, color: brandColor } : undefined}>
                  {doc.title.length > 18 ? doc.title.slice(0, 18) + "..." : doc.title}
                </button>
              ))}
            </div>
          )}
          {activeDoc?.pdf_path && (
            <Button variant="ghost" size="sm" asChild className="h-7 gap-1 text-[11px] text-white/35 hover:text-white/60">
              <a href={activeDoc.pdf_path} download target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3" /> PDF</a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setChatOpen(!chatOpen)}
            className="h-7 gap-1.5 border-white/10 bg-white/[0.02] text-[11px] text-white/50 hover:bg-white/[0.05]">
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
            case "divider": return <div key={section.id} className="my-16"><div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}15, transparent)` }} /></div>;
            default: return null;
          }
        })}
        <footer className="flex flex-col items-center gap-4 py-24">
          <div className="h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}25, transparent)` }} />
          {portal.logo_url && <img src={portal.logo_url} alt="" className="h-6 w-auto opacity-30" />}
          <p className="text-[11px] text-white/15">Prepared by Mirror Factory</p>
        </footer>
      </main>

      {/* Chat — bottom-right floating panel */}
      {chatOpen && (
        <div className="fixed bottom-4 right-4 z-[60] w-[400px] max-w-[calc(100vw-32px)] h-[520px] max-h-[70vh] rounded-2xl border border-white/[0.08] bg-[#0a0a0f]/95 shadow-2xl backdrop-blur-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 shrink-0">
            <span className="text-xs font-medium text-white/60">Ask about this proposal</span>
            <button onClick={() => setChatOpen(false)} className="text-white/30 hover:text-white/60"><X className="h-3.5 w-3.5" /></button>
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
            />
          </div>
        </div>
      )}

      {/* Chat FAB */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
          style={{ backgroundColor: brandColor, boxShadow: `0 6px 24px ${brandColor}40` }}>
          <MessageSquare className="h-4.5 w-4.5 text-white" />
        </button>
      )}
    </div>
  );
}
