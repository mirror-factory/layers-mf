"use client";

/**
 * Rich text content renderer for portal documents.
 * Lightweight: no per-section observers, charts on-demand only.
 */

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, BarChart3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Section {
  id: string;
  type: "heading" | "paragraph" | "list" | "table" | "budget" | "milestone" | "phase" | "divider";
  level?: number;
  title?: string;
  content: string;
  items?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  budgetRows?: { phase: string; timeline: string; investment: string }[];
  milestones?: { phase: string; dates: string; detail: string }[];
  phases?: { name: string; timeline: string; desc: string }[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function clean(s: string): string {
  return s.replace(/\*\*/g, "").replace(/\\\\/g, "").replace(/\\\./g, ".").trim();
}

function parseContent(text: string): Section[] {
  if (!text) return [];
  // Pre-filter: remove empty lines so triplet patterns (Phase/Timeline/Investment) work
  // even when the source has blank lines between every field
  const lines = text.split("\n").filter(l => l.trim() !== "");
  const sections: Section[] = [];
  let idx = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i].trim();
    if (/^(\*\*)?!?\[/.test(raw)) { i++; continue; }
    if (/^(Prepared|Date:|Revision:|\*\*Prepared|\*\*Date|\*\*Revision)/i.test(clean(raw))) { i++; continue; }

    // Markdown tables
    if (raw.startsWith("|") && raw.includes("|")) {
      const headers = raw.split("|").map(c => clean(c)).filter(Boolean);
      let j = i + 1;
      if (j < lines.length && /^[|\s:-]+$/.test(lines[j].trim())) j++;
      const rows: string[][] = [];
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        const cells = lines[j].split("|").map(c => clean(c)).filter(Boolean);
        if (cells.length > 0) rows.push(cells);
        j++;
      }
      if (headers.length >= 2 && rows.length > 0) {
        idx++;
        const invCol = headers.findIndex(h => /investment|cost|price/i.test(h));
        const phCol = headers.findIndex(h => /phase|item/i.test(h));
        const tmCol = headers.findIndex(h => /timeline|duration/i.test(h));
        if (invCol >= 0 && phCol >= 0 && rows.length >= 2) {
          sections.push({ id: `s${idx}`, type: "budget", content: "", budgetRows: rows.map(r => ({ phase: r[phCol] ?? "", timeline: tmCol >= 0 ? (r[tmCol] ?? "") : "", investment: r[invCol] ?? "" })) });
          i = j; continue;
        }
        const dtCol = headers.findIndex(h => /dates?|target|when/i.test(h));
        const msCol = headers.findIndex(h => /milestone|deliverable|key/i.test(h));
        if (dtCol >= 0 && msCol >= 0 && phCol >= 0) {
          sections.push({ id: `s${idx}`, type: "milestone", content: "", milestones: rows.map(r => ({ phase: r[phCol] ?? "", dates: r[dtCol] ?? "", detail: r[msCol] ?? "" })) });
          i = j; continue;
        }
        sections.push({ id: `s${idx}`, type: "table", content: "", tableHeaders: headers, tableRows: rows });
        i = j; continue;
      }
    }

    // Budget triplet
    if (/^Phase$/i.test(clean(raw)) && i + 1 < lines.length && /timeline/i.test(clean(lines[i + 1])) && i + 2 < lines.length && /investment/i.test(clean(lines[i + 2]))) {
      const budgetRows: Section["budgetRows"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = clean(lines[j]), t = clean(lines[j + 1]), inv = clean(lines[j + 2]);
        if (!p || /^(Phase\s*$|Timeline|Milestones)/i.test(p)) break;
        budgetRows.push({ phase: p, timeline: t, investment: inv }); j += 3;
      }
      if (budgetRows.length > 0) { idx++; sections.push({ id: `s${idx}`, type: "budget", content: "", budgetRows }); i = j; continue; }
    }

    // Milestone triplet
    if (/^Phase$/i.test(clean(raw)) && i + 1 < lines.length && /target dates/i.test(clean(lines[i + 1])) && i + 2 < lines.length && /key milestones/i.test(clean(lines[i + 2]))) {
      const milestones: Section["milestones"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = clean(lines[j]), d = clean(lines[j + 1]), m = clean(lines[j + 2]);
        if (!p || /^(Timeline|Phase\s*$)/i.test(p)) break;
        milestones.push({ phase: p, dates: d, detail: m }); j += 3;
      }
      if (milestones.length > 0) { idx++; sections.push({ id: `s${idx}`, type: "milestone", content: "", milestones }); i = j; continue; }
    }

    // Phase blocks
    const phMatch = raw.match(/^Phase\s+(\d+)[\s:]+(.+)/i);
    if (phMatch && !raw.startsWith("|")) {
      const phases: Section["phases"] = [];
      let j = i;
      while (j < lines.length) {
        const pm = lines[j].trim().match(/^Phase\s+(\d+)[\s:]+(.+)/i);
        if (!pm && phases.length > 0) break;
        if (pm) {
          j++;
          const desc: string[] = [];
          while (j < lines.length) {
            const dl = lines[j].trim();
            if (!dl || dl.match(/^Phase\s+\d+/i) || clean(dl).match(/^\d+\.\s/) || dl.startsWith("|")) break;
            desc.push(clean(dl)); j++;
          }
          phases.push({ name: `Phase ${pm[1]}`, timeline: clean(pm[2]).replace(/[()]/g, ""), desc: desc.join(" ") });
        } else j++;
      }
      if (phases.length >= 2) { idx++; sections.push({ id: `s${idx}`, type: "phase", content: "", phases }); i = j; continue; }
    }

    // Headings
    const numH = clean(raw).match(/^(\d+(?:\.\d+)*)\.?\s+(.{2,100})/);
    if (numH && raw.length < 120 && !clean(raw).includes(". ")) {
      const dots = (numH[1].match(/\./g) || []).length;
      idx++; sections.push({ id: `s${idx}`, type: "heading", level: dots + 1, title: clean(numH[2]), content: "" }); i++; continue;
    }
    if (/^\*\*[^*]+\*\*$/.test(raw) && raw.length < 100) {
      const t = clean(raw);
      if (t.length >= 3 && !/^(Prepared|Date|Revision)/.test(t)) {
        idx++; sections.push({ id: `s${idx}`, type: "heading", level: /^\d/.test(t) ? 2 : 3, title: t, content: "" }); i++; continue;
      }
    }
    const mdH = raw.match(/^(#{1,4})\s+(.+)/);
    if (mdH) { idx++; sections.push({ id: `s${idx}`, type: "heading", level: mdH[1].length, title: clean(mdH[2]), content: "" }); i++; continue; }

    // Lists — batch into single section
    if (raw.startsWith("- ") || raw.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        items.push(clean(lines[i].trim().slice(2))); i++;
      }
      idx++; sections.push({ id: `s${idx}`, type: "list", content: "", items }); continue;
    }

    // Divider
    if (raw.match(/^[-=_*]{3,}$/)) { sections.push({ id: `d${idx}`, type: "divider", content: "" }); i++; continue; }

    // Paragraph — merge consecutive lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ") && !lines[i].trim().startsWith("|") && !clean(lines[i]).match(/^\d+\.\s+[A-Z]/) && !/^\*\*[^*]+\*\*$/.test(lines[i].trim())) {
      para.push(clean(lines[i])); i++;
    }
    if (para.length > 0) { idx++; sections.push({ id: `s${idx}`, type: "paragraph", content: para.join(" ") }); }
    else { i++; } // SAFETY: always advance to prevent infinite loop on unmatched lines
  }
  return sections;
}

// ---------------------------------------------------------------------------
// On-demand chart (only loads when user clicks "Show chart")
// ---------------------------------------------------------------------------

function OnDemandChart({ config }: { config: object }) {
  const [show, setShow] = useState(false);
  const html = useMemo(() => show ? `<!DOCTYPE html><html><head>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script>
<style>body{margin:0;background:transparent;display:flex;justify-content:center;align-items:center;height:100%}</style>
</head><body><canvas id="c"></canvas>
<script>new Chart(document.getElementById('c'),${JSON.stringify(config)})<\/script>
</body></html>` : "", [show, config]);

  if (!show) {
    return (
      <button onClick={() => setShow(true)}
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/60">
        <BarChart3 className="h-3 w-3" /> Show chart
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-white/[0.05] bg-white/[0.01] overflow-hidden">
      <iframe srcDoc={html} className="w-full border-0 bg-transparent" style={{ height: 220 }} sandbox="allow-scripts" title="Chart" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Renderers (no IntersectionObserver — pure CSS for performance)
// ---------------------------------------------------------------------------

function RHeading({ s, brandColor }: { s: Section; brandColor: string }) {
  const lv = s.level ?? 1;
  return (
    <div id={s.id} className={cn("scroll-mt-4", lv === 1 && "mt-10 mb-4", lv === 2 && "mt-8 mb-3", lv >= 3 && "mt-6 mb-2")}>
      {lv === 1 && <div className="mb-3 h-px" style={{ background: `linear-gradient(90deg, ${brandColor}30, transparent)` }} />}
      {lv === 1 ? <h2 className="text-xl font-bold text-white">{s.title}</h2>
        : lv === 2 ? <h3 className="text-lg font-semibold text-white/90">{s.title}</h3>
        : <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: `${brandColor}bb` }}>{s.title}</h4>}
    </div>
  );
}

function RParagraph({ s }: { s: Section }) {
  return (
    <div className="my-2">
      <p className="text-[16px] leading-[1.75] text-white/55">{s.content}</p>
    </div>
  );
}

function RList({ s, brandColor }: { s: Section; brandColor: string }) {
  return (
    <ul className="my-4 space-y-1.5">
      {(s.items ?? []).map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 py-1">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: brandColor }} />
          <span className="text-[15px] leading-relaxed text-white/55">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RTable({ s, brandColor }: { s: Section; brandColor: string }) {
  const headers = s.tableHeaders ?? [];
  const rows = s.tableRows ?? [];

  // Only offer chart if there's numeric data
  const numCol = headers.findIndex((_, ci) => rows.filter(r => /[\d.]+/.test((r[ci] ?? "").replace(/[$,~%<>]/g, ""))).length >= 2);
  const chartCfg = useMemo(() => {
    if (numCol < 1 || rows.length < 2) return null;
    const labels = rows.map(r => (r[0] ?? "").slice(0, 25));
    const values = rows.map(r => parseFloat((r[numCol] ?? "0").replace(/[$,~%<>]/g, "")) || 0);
    if (values.every(v => v === 0)) return null;
    return {
      type: rows.length <= 5 ? "doughnut" : "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: rows.map((_, i) => `${brandColor}${Math.round(((i + 1) / rows.length) * 160 + 80).toString(16).padStart(2, "0")}`), borderColor: "transparent", borderRadius: 4 }] },
      options: { responsive: true, plugins: { legend: { position: "right", labels: { color: "rgba(255,255,255,0.45)", font: { size: 10 } } } } },
    };
  }, [headers, rows, numCol, brandColor]);

  return (
    <div className="my-5">
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead><tr style={{ backgroundColor: `${brandColor}08` }}>
              {headers.map((h, i) => <th key={i} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((row, ri) => (
              <tr key={ri} className="border-t border-white/[0.04] hover:bg-white/[0.015]">
                {row.map((c, ci) => <td key={ci} className={cn("px-4 py-2.5", ci === 0 ? "font-medium text-white/65" : "text-white/50")}>{c}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {chartCfg && <OnDemandChart config={chartCfg} />}
    </div>
  );
}

function RBudget({ s, brandColor }: { s: Section; brandColor: string }) {
  const rows = s.budgetRows ?? [];
  const chartCfg = useMemo(() => {
    const withNums = rows.filter(r => r.investment.includes("$"));
    if (withNums.length < 2) return null;
    const labels = withNums.map((_, i) => `Phase ${i + 1}`);
    const values = withNums.map(r => { const m = r.investment.match(/\$([\d,]+)/); return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0; });
    return {
      type: "bar", data: { labels, datasets: [{ data: values, backgroundColor: withNums.map((_, i) => `${brandColor}${Math.round(((i + 1) / withNums.length) * 140 + 100).toString(16).padStart(2, "0")}`), borderColor: "transparent", borderRadius: 6, barPercentage: 0.5 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "rgba(255,255,255,0.4)" }, grid: { display: false } }, y: { ticks: { color: "rgba(255,255,255,0.3)" }, grid: { color: "rgba(255,255,255,0.04)" } } } },
    };
  }, [rows, brandColor]);

  return (
    <div className="my-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">{r.phase.length > 35 ? r.phase.slice(0, 35) + "..." : r.phase}</p>
            <p className="mb-1 text-2xl font-bold" style={r.investment.includes("$") ? { background: `linear-gradient(135deg, #fff 30%, ${brandColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : { color: "rgba(255,255,255,0.65)" }}>{r.investment}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-white/30"><Clock className="h-3 w-3" />{r.timeline}</div>
          </div>
        ))}
      </div>
      {chartCfg && <OnDemandChart config={chartCfg} />}
    </div>
  );
}

function RMilestone({ s, brandColor }: { s: Section; brandColor: string }) {
  const ms = s.milestones ?? [];
  return (
    <div className="my-6 space-y-2">
      {ms.map((m, i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.01] p-4">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}25` }} />
            {i < ms.length - 1 && <div className="flex-1 w-px" style={{ backgroundColor: `${brandColor}12` }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white">{m.phase}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${brandColor}0d`, color: `${brandColor}bb` }}>{m.dates}</span>
            </div>
            <p className="text-[15px] text-white/40 leading-relaxed">{m.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RPhase({ s, brandColor }: { s: Section; brandColor: string }) {
  const phases = s.phases ?? [];
  return (
    <div className="my-8">
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: `linear-gradient(180deg, transparent, ${brandColor}30, transparent)` }} />
        <div className="space-y-5">
          {phases.map((p, i) => (
            <div key={i} className="relative pl-14">
              <div className="absolute left-0 top-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold" style={{ borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor }}>
                  {i + 1}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
                <div className="text-base font-bold text-white">{p.name}</div>
                <div className="mt-1 mb-2 flex items-center gap-1.5 text-[11px]" style={{ color: `${brandColor}aa` }}><Clock className="h-3 w-3" />{p.timeline}</div>
                <p className="text-[15px] leading-relaxed text-white/45">{p.desc.length > 250 ? p.desc.slice(0, 250) + "..." : p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function RichTextContent({ content, brandColor = "#0DE4F2" }: { content: string; brandColor?: string }) {
  const sections = useMemo(() => parseContent(content), [content]);

  return (
    <div className="space-y-0.5">
      {sections.map((s) => {
        switch (s.type) {
          case "heading": return <RHeading key={s.id} s={s} brandColor={brandColor} />;
          case "paragraph": return <RParagraph key={s.id} s={s} />;
          case "list": return <RList key={s.id} s={s} brandColor={brandColor} />;
          case "table": return <RTable key={s.id} s={s} brandColor={brandColor} />;
          case "budget": return <RBudget key={s.id} s={s} brandColor={brandColor} />;
          case "milestone": return <RMilestone key={s.id} s={s} brandColor={brandColor} />;
          case "phase": return <RPhase key={s.id} s={s} brandColor={brandColor} />;
          case "divider": return <div key={s.id} className="my-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}15, transparent)` }} />;
          default: return null;
        }
      })}
    </div>
  );
}
