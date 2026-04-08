"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  BarChart3, BookOpen, CheckCircle2, ChevronDown, ChevronRight,
  Clock, DollarSign, Download, List, MessageSquare, Sparkles,
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
  type: "hero" | "heading" | "paragraph" | "list" | "data-table" | "phase-timeline" | "budget-table" | "milestone-timeline" | "divider";
  level?: number;
  title?: string;
  content: string;
  items?: string[];
  tableRows?: string[][];
  tableHeaders?: string[];
  phases?: { name: string; timeline: string; description: string; investment?: string }[];
  budgetRows?: { phase: string; timeline: string; investment: string }[];
  milestones?: { phase: string; dates: string; milestones: string }[];
}

interface TocEntry { id: string; title: string; level: number; }

// ---------------------------------------------------------------------------
// Parser Helpers
// ---------------------------------------------------------------------------

function cleanBold(s: string): string { return s.replace(/\*\*/g, "").replace(/\\\\/g, "").trim(); }

function parseMarkdownTable(lines: string[], startIdx: number): { headers: string[]; rows: string[][]; endIdx: number } {
  const headers = lines[startIdx].split("|").map(c => cleanBold(c.trim())).filter(Boolean);
  let j = startIdx + 1;
  // Skip separator row (| --- | --- |)
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
    if (/^(\*\*)?!?\[/.test(raw)) { i++; continue; } // image refs
    if (/^(Prepared (by|for)|Date:|Revision:|\*\*Prepared|\*\*Date|\*\*Revision)/i.test(cleanBold(raw))) { i++; continue; }
    if (/\bx\b/.test(cleanBold(raw)) && raw.length < 80 && i < 15) { i++; continue; }

    // Markdown tables
    if (raw.startsWith("|") && raw.includes("|")) {
      const { headers, rows, endIdx } = parseMarkdownTable(lines, i);
      if (headers.length >= 2 && rows.length > 0) {
        idx++;

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

    // Budget triplet format (Phase / Timeline / Investment as 3 separate lines)
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

    // Short title-like lines (no period, starts uppercase, under 60 chars)
    const cleaned = cleanBold(raw);
    if (cleaned.length >= 3 && cleaned.length < 60 && !cleaned.includes(". ") && !cleaned.endsWith(".") && /^[A-Z]/.test(cleaned)
      && !/^(Phase|The |A |An |In |On |At |By |To |If |No |When |Every |Full |Mirror |Swell |Blue|Charlie|This )/.test(cleaned)) {
      idx++; sections.push({ id: `s-${idx}`, type: "heading", level: 3, title: cleaned, content: "" }); i++; continue;
    }

    // List items (- or * or JTBD-style "* **bold** — text")
    if (raw.startsWith("- ") || raw.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("- ") || l.startsWith("* ")) {
          items.push(cleanBold(l.slice(2)));
        } else break;
        i++;
      }
      idx++; sections.push({ id: `s-${idx}`, type: "list", content: "", items }); continue;
    }

    // Divider
    if (raw.match(/^[-=_*]{3,}$/)) { sections.push({ id: `div-${idx}`, type: "divider", content: "" }); i++; continue; }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ") && !lines[i].trim().startsWith("|") && !cleanBold(lines[i]).match(/^\d+\\?\.\s+[A-Z]/) && !/^\*\*[^*]+\*\*$/.test(lines[i].trim())) {
      paraLines.push(cleanBold(lines[i])); i++;
    }
    if (paraLines.length > 0) { idx++; sections.push({ id: `s-${idx}`, type: "paragraph", content: paraLines.join(" ") }); }
  }
  return sections;
}

function buildToc(sections: DocSection[]): TocEntry[] {
  return sections.filter(s => s.type === "heading" && s.title && (s.level ?? 1) <= 2).map(s => ({ id: s.id, title: s.title!, level: s.level ?? 1 }));
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useScrollAnimation(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { delay ? setTimeout(() => setVis(true), delay) : setVis(true); obs.unobserve(el); } }, { threshold: 0.08, rootMargin: "0px 0px -20px 0px" });
    obs.observe(el); return () => obs.disconnect();
  }, [delay]);
  return { ref, isVisible: vis };
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
// Interactive Chart Wrapper — Chart.js in iframe with AI overlay
// ---------------------------------------------------------------------------

function InteractiveChart({ config, brandColor, shareToken, title }: {
  config: object; brandColor: string; shareToken: string; title?: string;
}) {
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const html = useMemo(() => `<!DOCTYPE html>
<html><head><script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script>
<style>body{margin:0;background:transparent;display:flex;justify-content:center;align-items:center;min-height:100%;font-family:system-ui}</style>
</head><body><canvas id="c" style="max-height:280px"></canvas>
<script>new Chart(document.getElementById('c'),${JSON.stringify(config)})<\/script>
</body></html>`, [config]);

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

  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
      <iframe srcDoc={html} className="h-[280px] w-full border-0 bg-transparent" sandbox="allow-scripts" title={title || "Chart"} />
      {/* AI overlay on hover */}
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
    <div ref={ref} id={section.id} className={cn("scroll-mt-16 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0", lv === 1 && "mb-5 mt-20", lv === 2 && "mb-4 mt-14", lv >= 3 && "mb-3 mt-8")}>
      {lv === 1 && <div className="mb-5 flex items-center gap-4"><div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${brandColor}30, transparent)` }} /><div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}12` }}><Zap className="h-3.5 w-3.5" style={{ color: brandColor }} /></div><div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${brandColor}30, transparent)` }} /></div>}
      {lv === 1 ? <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">{section.title}</h2>
        : lv === 2 ? <h3 className="text-xl font-semibold text-white/90">{section.title}</h3>
        : <h4 className="text-sm font-semibold tracking-wider uppercase" style={{ color: `${brandColor}bb` }}>{section.title}</h4>}
    </div>
  );
}

function ParagraphSection({ section }: { section: DocSection }) {
  const { ref, isVisible } = useScrollAnimation();
  const isLong = section.content.length > 200;
  return (
    <div ref={ref} className={cn("my-3 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      {isLong ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5">
          <p className="text-[14px] leading-[1.75] text-white/50">{section.content}</p>
        </div>
      ) : (
        <p className="text-[14px] leading-[1.75] text-white/50">{section.content}</p>
      )}
    </div>
  );
}

function ListSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const items = section.items ?? [];
  // Long items (JTBD-style) → single column cards; short items → 2 col
  const isLong = items.some(it => it.length > 120);
  return (
    <div ref={ref} className={cn("my-5 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0", !isLong && "grid gap-2.5 sm:grid-cols-2")}>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 transition-all hover:border-white/[0.08] hover:bg-white/[0.025]"
          style={{ transitionDelay: isVisible ? `${i * 40}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(6px)" }}>
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: brandColor }} />
          <span className="text-[13px] leading-relaxed text-white/55">{item}</span>
        </div>
      ))}
    </div>
  );
}

function DataTableSection({ section, brandColor, shareToken }: { section: DocSection; brandColor: string; shareToken: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const headers = section.tableHeaders ?? [];
  const rows = section.tableRows ?? [];

  // Auto-generate chart for tables with numeric data
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
    <div ref={ref} className={cn("my-6 transition-all duration-600", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      {/* Card-style table */}
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr style={{ backgroundColor: `${brandColor}08` }}>
              {headers.map((h, hi) => <th key={hi} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((row, ri) => (
              <tr key={ri} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                {row.map((cell, ci) => <td key={ci} className={cn("px-4 py-3", ci === 0 ? "font-medium text-white/70" : "text-white/50")}>{cell}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {/* Auto-chart */}
      {chartConfig && (
        <div className="mt-4">
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
    <div ref={ref} className={cn("my-10 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px sm:left-1/2" style={{ background: `linear-gradient(180deg, transparent, ${brandColor}35, ${brandColor}35, transparent)` }} />
        <div className="space-y-6">
          {phases.map((phase, i) => {
            const Icon = icons[i % icons.length]; const isLeft = i % 2 === 0;
            return (
              <div key={i} className="relative transition-all duration-700" style={{ transitionDelay: isVisible ? `${i * 180}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(16px)" }}>
                <div className="absolute left-6 top-5 z-10 -translate-x-1/2 sm:left-1/2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}12` }}>
                    <Icon className="h-4 w-4" style={{ color: brandColor }} />
                  </div>
                </div>
                <div className={cn("ml-14 sm:ml-0 sm:w-[calc(50%-36px)]", isLeft ? "sm:mr-auto" : "sm:ml-auto")}>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 transition-all hover:border-white/[0.1] hover:bg-white/[0.025]">
                    <div className="mb-1 text-base font-bold text-white">{phase.name}</div>
                    <div className="mb-3 flex items-center gap-2 text-[11px]" style={{ color: `${brandColor}bb` }}><Clock className="h-3 w-3" />{phase.timeline}</div>
                    <p className="text-[13px] leading-relaxed text-white/45">{phase.description.length > 250 ? phase.description.slice(0, 250) + "..." : phase.description}</p>
                  </div>
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
    <div ref={ref} className={cn("my-8 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((row, i) => (
          <div key={i} className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 transition-all hover:border-white/[0.1] hover:bg-white/[0.025]"
            style={{ transitionDelay: isVisible ? `${i * 120}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "scale(1)" : "scale(0.97)" }}>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">{row.phase.length > 40 ? row.phase.slice(0, 40) + "..." : row.phase}</p>
            <p className="mb-1.5 text-2xl font-bold" style={row.investment.includes("$") ? { background: `linear-gradient(135deg, #fff 30%, ${brandColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : { color: "rgba(255,255,255,0.7)" }}>
              {row.investment}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-white/35"><Clock className="h-3 w-3" />{row.timeline}</div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}50, transparent)` }} />
          </div>
        ))}
      </div>
      {chartConfig && <div className="mt-4"><InteractiveChart config={chartConfig} brandColor={brandColor} shareToken={shareToken} title="Budget by Phase" /></div>}
    </div>
  );
}

function MilestoneTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const ms = section.milestones ?? [];
  return (
    <div ref={ref} className={cn("my-8 space-y-3 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
      {ms.map((m, i) => (
        <div key={i} className="group flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 transition-all hover:border-white/[0.08] hover:bg-white/[0.02]"
          style={{ transitionDelay: isVisible ? `${i * 100}ms` : "0ms", opacity: isVisible ? 1 : 0 }}>
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}30` }} />
            {i < ms.length - 1 && <div className="flex-1 w-px" style={{ backgroundColor: `${brandColor}15` }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white">{m.phase}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${brandColor}10`, color: `${brandColor}bb` }}>{m.dates}</span>
            </div>
            <p className="text-[13px] text-white/40 leading-relaxed">{m.milestones}</p>
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
  const [activeDocId, setActiveDocId] = useState<string | null>(portal.documents?.find(d => d.is_active)?.id ?? portal.documents?.[0]?.id ?? null);
  const brandColor = portal.brand_color || "#0DE4F2";
  const activeDoc = portal.documents?.find(d => d.id === activeDocId) ?? portal.documents?.[0];
  const content = activeDoc?.content ?? portal.document_content ?? "";
  const sections = useMemo(() => parseDocument(content, activeDoc?.title ?? portal.title, portal.client_name ?? "Client"), [content, activeDoc?.title, portal.title, portal.client_name]);
  const tocEntries = useMemo(() => buildToc(sections), [sections]);
  const extraHeaders = useMemo(() => ({ "x-portal-token": portal.share_token }), [portal.share_token]);
  const handleDocSwitch = useCallback((doc: PortalDocument) => { setActiveDocId(doc.id); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <FloatingToc entries={tocEntries} brandColor={brandColor} />

      {/* Nav */}
      <nav className="fixed top-0 z-[45] flex w-full items-center justify-between border-b border-white/[0.06] bg-[#050508]/80 px-6 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3 pl-28">
          {portal.logo_url && <img src={portal.logo_url} alt="" className="h-5 w-auto opacity-70" />}
          <span className="text-[11px] text-white/30">Prepared by <span className="text-white/50">Mirror Factory</span></span>
        </div>
        <div className="flex items-center gap-2">
          {portal.documents && portal.documents.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              {portal.documents.map(doc => (
                <button key={doc.id} onClick={() => handleDocSwitch(doc)}
                  className={cn("rounded-md px-2.5 py-1 text-[11px] transition-all", doc.id === activeDocId ? "font-medium" : "text-white/30 hover:text-white/55")}
                  style={doc.id === activeDocId ? { backgroundColor: `${brandColor}18`, color: brandColor } : undefined}>
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
            case "paragraph": return <ParagraphSection key={section.id} section={section} />;
            case "list": return <ListSection key={section.id} section={section} brandColor={brandColor} />;
            case "data-table": return <DataTableSection key={section.id} section={section} brandColor={brandColor} shareToken={portal.share_token} />;
            case "phase-timeline": return <PhaseTimeline key={section.id} section={section} brandColor={brandColor} />;
            case "budget-table": return <BudgetSection key={section.id} section={section} brandColor={brandColor} shareToken={portal.share_token} />;
            case "milestone-timeline": return <MilestoneTimeline key={section.id} section={section} brandColor={brandColor} />;
            case "divider": return <div key={section.id} className="my-12"><div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}15, transparent)` }} /></div>;
            default: return null;
          }
        })}
        <footer className="flex flex-col items-center gap-4 py-20">
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
