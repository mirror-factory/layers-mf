"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Lightbulb,
  List,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sparkles,
  Target,
  X,
  Zap,
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
  type: "hero" | "heading" | "paragraph" | "list" | "phase-timeline" | "budget-table" | "milestone-timeline" | "kpi" | "divider";
  level?: number;
  title?: string;
  content: string;
  items?: string[];
  phases?: { name: string; timeline: string; description: string; investment?: string }[];
  budgetRows?: { phase: string; timeline: string; investment: string }[];
  milestones?: { phase: string; dates: string; milestones: string }[];
}

interface TocEntry { id: string; title: string; level: number; }

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
    if (/^(Prepared (by|for)|Date:|Revision:)/i.test(raw)) { i++; continue; }
    if (/\bx\b/.test(raw) && raw.length < 80 && i < 10) { i++; continue; }

    // Phase blocks
    const phaseHeaderMatch = raw.match(/^Phase\s+(\d+)[\s:]+(.+)/i);
    if (phaseHeaderMatch) {
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
            if (!dl || dl.match(/^Phase\s+\d+/i) || dl.match(/^\d+\.\s/) || dl.match(/^#{1,4}\s/)) break;
            descLines.push(dl);
            j++;
          }
          phases.push({ name: `Phase ${pm[1]}`, timeline: pm[2].replace(/[()]/g, "").trim(), description: descLines.join(" ") });
        } else { j++; }
      }
      if (phases.length >= 2) { idx++; sections.push({ id: `s-${idx}`, type: "phase-timeline", content: "", phases }); i = j; continue; }
    }

    // Budget table
    if (/^Phase$/i.test(raw) && i + 1 < lines.length && /timeline/i.test(lines[i + 1].trim()) && i + 2 < lines.length && /investment/i.test(lines[i + 2].trim())) {
      const budgetRows: DocSection["budgetRows"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = lines[j].trim(), t = lines[j + 1].trim(), inv = lines[j + 2].trim();
        if (!p || p.match(/^(Phase\s*$|Timeline|Milestones)/i)) break;
        budgetRows.push({ phase: p, timeline: t, investment: inv });
        j += 3;
      }
      if (budgetRows.length > 0) { idx++; sections.push({ id: `s-${idx}`, type: "budget-table", content: "", budgetRows }); i = j; continue; }
    }

    // Milestone table
    if (/^Phase$/i.test(raw) && i + 1 < lines.length && /target dates/i.test(lines[i + 1].trim()) && i + 2 < lines.length && /key milestones/i.test(lines[i + 2].trim())) {
      const milestones: DocSection["milestones"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = lines[j].trim(), d = lines[j + 1].trim(), m = lines[j + 2].trim();
        if (!p || /^(Timeline|Phase\s*$)/i.test(p)) break;
        milestones.push({ phase: p, dates: d, milestones: m });
        j += 3;
      }
      if (milestones.length > 0) { idx++; sections.push({ id: `s-${idx}`, type: "milestone-timeline", content: "", milestones }); i = j; continue; }
    }

    // Numbered headings
    const numberedMatch = raw.match(/^(\d+)\.\s+(.{2,100})/);
    if (numberedMatch && raw.length < 100) { idx++; sections.push({ id: `s-${idx}`, type: "heading", level: 1, title: numberedMatch[2].replace(/\*\*/g, ""), content: "" }); i++; continue; }

    // Markdown headings
    const headingMatch = raw.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) { idx++; sections.push({ id: `s-${idx}`, type: "heading", level: headingMatch[1].length, title: headingMatch[2].replace(/\*\*/g, ""), content: "" }); i++; continue; }

    // Sub-headings
    if (raw.length < 60 && !raw.includes(".") && /^[A-Z]/.test(raw) && !/^(Phase|The|A |An |In |On |At |By |To |If |No )/.test(raw)) {
      idx++; sections.push({ id: `s-${idx}`, type: "heading", level: 3, title: raw.replace(/\*\*/g, ""), content: "" }); i++; continue;
    }

    // List items
    if (raw.startsWith("- ") || raw.startsWith("* ") || raw.match(/^[a-z]\.\s/)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("- ") || l.startsWith("* ")) items.push(l.slice(2).replace(/\*\*/g, ""));
        else if (l.match(/^[a-z]\.\s/)) items.push(l.replace(/^[a-z]\.\s*/, "").replace(/\*\*/g, ""));
        else break;
        i++;
      }
      idx++; sections.push({ id: `s-${idx}`, type: "list", content: "", items }); continue;
    }

    // Divider
    if (raw.match(/^[-=_*]{3,}$/)) { sections.push({ id: `div-${idx}`, type: "divider", content: "" }); i++; continue; }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ") && !lines[i].trim().match(/^\d+\.\s+[A-Z]/)) {
      paraLines.push(lines[i].trim()); i++;
    }
    if (paraLines.length > 0) { idx++; sections.push({ id: `s-${idx}`, type: "paragraph", content: paraLines.join(" ").replace(/\*\*/g, "") }); }
  }

  return sections;
}

function buildToc(sections: DocSection[]): TocEntry[] {
  return sections.filter((s) => s.type === "heading" && s.title).map((s) => ({ id: s.id, title: s.title!, level: s.level ?? 1 }));
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useScrollAnimation(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { delay > 0 ? setTimeout(() => setIsVisible(true), delay) : setIsVisible(true); obs.unobserve(el); } }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return { ref, isVisible };
}

// ---------------------------------------------------------------------------
// TOC Sidebar
// ---------------------------------------------------------------------------

function TocSidebar({ entries, brandColor, open, onToggle }: {
  entries: TocEntry[]; brandColor: string; open: boolean; onToggle: () => void;
}) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Toggle button — always visible */}
      <button onClick={onToggle}
        className="fixed left-4 top-16 z-[60] flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-[#0a0a0f]/90 text-white/50 backdrop-blur-xl transition-all hover:bg-white/[0.05] hover:text-white/80"
        title={open ? "Close table of contents" : "Open table of contents"}>
        {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </button>

      {/* Sidebar panel */}
      <div className={cn(
        "fixed left-0 top-0 z-50 h-full w-72 border-r border-white/[0.06] bg-[#070709]/95 backdrop-blur-xl transition-transform duration-300",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: brandColor }} />
            <span className="text-sm font-medium text-white/80">Contents</span>
          </div>
          <button onClick={onToggle} className="text-white/40 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 60px)" }}>
          <div className="space-y-0.5">
            {entries.map((entry) => (
              <button key={entry.id} onClick={() => scrollTo(entry.id)}
                className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/50 transition-all hover:bg-white/[0.04] hover:text-white/80"
                style={{ paddingLeft: `${(entry.level - 1) * 14 + 12}px` }}>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: brandColor }} />
                <span className={cn("line-clamp-2", entry.level === 1 && "font-medium text-white/60")}>{entry.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={onToggle} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Section Components
// ---------------------------------------------------------------------------

function HeroSection({ title, clientName, brandColor, logoUrl, subtitle }: {
  title: string; clientName: string; brandColor: string; logoUrl: string | null; subtitle: string | null;
}) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div ref={ref} className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 py-24">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${brandColor}18 0%, transparent 70%)` }} />
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: `linear-gradient(${brandColor}60 1px, transparent 1px), linear-gradient(90deg, ${brandColor}60 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}40, transparent)` }} />

      <div className={cn("relative z-10 flex max-w-4xl flex-col items-center gap-8 text-center transition-all duration-1000 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0")}>
        {logoUrl && <img src={logoUrl} alt={`${clientName} logo`} className="h-14 w-auto opacity-90" />}
        <div className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-medium tracking-widest uppercase"
          style={{ borderColor: `${brandColor}30`, color: brandColor, backgroundColor: `${brandColor}08` }}>
          <Sparkles className="h-3.5 w-3.5" /> Interactive Proposal
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl" style={{
          background: `linear-gradient(135deg, #ffffff 40%, ${brandColor} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>{title.replace(/Scope of Work —\s*/i, "").replace(/Proposal —\s*/i, "")}</h1>
        <p className="max-w-2xl text-lg text-white/40">{subtitle || `Prepared exclusively for ${clientName}`}</p>
        <div className="mt-6 flex items-center gap-4 text-xs text-white/20">
          <div className="h-px w-20" style={{ backgroundColor: `${brandColor}30` }} />
          <span className="tracking-widest uppercase">Scroll to explore</span>
          <div className="h-px w-20" style={{ backgroundColor: `${brandColor}30` }} />
        </div>
        <ChevronDown className="mt-4 h-5 w-5 animate-bounce" style={{ color: `${brandColor}50` }} />
      </div>
    </div>
  );
}

function HeadingSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const level = section.level ?? 1;
  return (
    <div ref={ref} id={section.id} className={cn("transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", level === 1 && "mb-6 mt-24", level === 2 && "mb-4 mt-16", level >= 3 && "mb-3 mt-10")}>
      {level === 1 && (
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${brandColor}40, transparent)` }} />
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
            <Zap className="h-4 w-4" style={{ color: brandColor }} />
          </div>
          <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${brandColor}40, transparent)` }} />
        </div>
      )}
      {level === 1 ? <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">{section.title}</h2>
        : level === 2 ? <h3 className="text-2xl font-semibold text-white/90">{section.title}</h3>
        : <h4 className="text-lg font-semibold tracking-wide uppercase" style={{ color: `${brandColor}cc` }}>{section.title}</h4>}
    </div>
  );
}

function ParagraphSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const isLong = section.content.length > 200;
  return (
    <div ref={ref} className={cn("group relative my-4 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      {isLong ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.03]">
          <p className="text-[15px] leading-[1.8] text-white/55 transition-colors group-hover:text-white/70">{section.content}</p>
        </div>
      ) : (
        <p className="text-[15px] leading-[1.8] text-white/55 transition-colors group-hover:text-white/70">{section.content}</p>
      )}
    </div>
  );
}

function ListSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div ref={ref} className={cn("my-6 grid gap-3 sm:grid-cols-2 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      {(section.items ?? []).map((item, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.03]"
          style={{ transitionDelay: isVisible ? `${i * 60}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(8px)" }}>
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brandColor }} />
          <span className="text-sm leading-relaxed text-white/60">{item}</span>
        </div>
      ))}
    </div>
  );
}

function PhaseTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const phases = section.phases ?? [];
  const icons = [Target, Zap, Sparkles, BarChart3];

  return (
    <div ref={ref} className={cn("my-12 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>
      <div className="relative">
        {/* Connector */}
        <div className="absolute left-6 top-0 bottom-0 w-px sm:left-1/2 sm:-translate-x-px" style={{ background: `linear-gradient(180deg, transparent, ${brandColor}40, ${brandColor}40, transparent)` }} />
        <div className="space-y-8">
          {phases.map((phase, i) => {
            const Icon = icons[i % icons.length];
            const isLeft = i % 2 === 0;
            return (
              <div key={i} className="relative transition-all duration-700" style={{ transitionDelay: isVisible ? `${i * 200}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(20px)" }}>
                <div className="absolute left-6 top-6 z-10 -translate-x-1/2 sm:left-1/2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}15` }}>
                    <Icon className="h-5 w-5" style={{ color: brandColor }} />
                  </div>
                </div>
                <div className={cn("ml-16 sm:ml-0 sm:w-[calc(50%-40px)]", isLeft ? "sm:mr-auto" : "sm:ml-auto")}>
                  <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]" style={{ boxShadow: `inset 0 1px 0 ${brandColor}10` }}>
                    <div className="mb-1 text-lg font-bold text-white">{phase.name}</div>
                    <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: `${brandColor}cc` }}><Clock className="h-3 w-3" />{phase.timeline}</div>
                    {phase.investment && <div className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${brandColor}12`, color: brandColor }}><DollarSign className="h-3 w-3" />{phase.investment}</div>}
                    <p className="text-sm leading-relaxed text-white/50 group-hover:text-white/65 transition-colors">{phase.description.length > 300 ? phase.description.slice(0, 300) + "..." : phase.description}</p>
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

function BudgetSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const rows = section.budgetRows ?? [];
  return (
    <div ref={ref} className={cn("my-10 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row, i) => (
          <div key={i} className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
            style={{ transitionDelay: isVisible ? `${i * 150}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)" }}>
            <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full opacity-0 transition-opacity group-hover:opacity-100 blur-2xl" style={{ backgroundColor: `${brandColor}20` }} />
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">{row.phase.replace(/Phase \d+:\s*/i, `Phase ${i + 1}`)}</p>
            <p className="mb-2 text-3xl font-bold text-white" style={row.investment.startsWith("$") ? { background: `linear-gradient(135deg, #ffffff 30%, ${brandColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : {}}>
              {row.investment}
            </p>
            <div className="flex items-center gap-2 text-xs text-white/40"><Clock className="h-3 w-3" />{row.timeline}</div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}60, transparent)` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const milestones = section.milestones ?? [];
  return (
    <div ref={ref} className={cn("my-10 transition-all duration-700", isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
      <div className="space-y-4">
        {milestones.map((m, i) => (
          <div key={i} className="group flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
            style={{ transitionDelay: isVisible ? `${i * 120}ms` : "0ms", opacity: isVisible ? 1 : 0, transform: isVisible ? "translateX(0)" : "translateX(-12px)" }}>
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="h-3 w-3 rounded-full border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}30` }} />
              {i < milestones.length - 1 && <div className="flex-1 w-px" style={{ backgroundColor: `${brandColor}20` }} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-3">
                <span className="font-semibold text-white">{m.phase}</span>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide" style={{ backgroundColor: `${brandColor}12`, color: `${brandColor}cc` }}>{m.dates}</span>
              </div>
              <p className="text-sm leading-relaxed text-white/45 transition-colors group-hover:text-white/60">{m.milestones}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Experience Component
// ---------------------------------------------------------------------------

export function PortalExperience({ portal }: { portal: PortalData }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(
    portal.documents?.find((d) => d.is_active)?.id ?? portal.documents?.[0]?.id ?? null
  );
  const brandColor = portal.brand_color || "#0DE4F2";

  const activeDoc = portal.documents?.find((d) => d.id === activeDocId) ?? portal.documents?.[0];
  const content = activeDoc?.content ?? portal.document_content ?? "";

  const sections = useMemo(() => parseDocument(content, activeDoc?.title ?? portal.title, portal.client_name ?? "Client"), [content, activeDoc?.title, portal.title, portal.client_name]);
  const tocEntries = useMemo(() => buildToc(sections), [sections]);

  const handleDocSwitch = useCallback((doc: PortalDocument) => {
    setActiveDocId(doc.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const extraHeaders = useMemo(() => ({ "x-portal-token": portal.share_token }), [portal.share_token]);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* TOC Sidebar */}
      <TocSidebar entries={tocEntries} brandColor={brandColor} open={tocOpen} onToggle={() => setTocOpen(!tocOpen)} />

      {/* Fixed nav */}
      <nav className="fixed top-0 z-[45] flex w-full items-center justify-between border-b border-white/[0.06] bg-[#050508]/80 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3 pl-10">
          {portal.logo_url && <img src={portal.logo_url} alt="" className="h-6 w-auto opacity-80" />}
          <span className="text-xs text-white/35">Prepared by <span className="text-white/55">Mirror Factory</span></span>
        </div>

        <div className="flex items-center gap-2">
          {/* TOC toggle */}
          <Button variant="ghost" size="sm" onClick={() => setTocOpen(!tocOpen)}
            className="gap-1.5 text-white/40 hover:text-white/70 hover:bg-white/[0.04]">
            <List className="h-3.5 w-3.5" /> Contents
          </Button>

          {/* Doc tabs */}
          {portal.documents && portal.documents.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              {portal.documents.map((doc) => (
                <button key={doc.id} onClick={() => handleDocSwitch(doc)}
                  className={cn("rounded-md px-3 py-1.5 text-xs transition-all", doc.id === activeDocId ? "font-medium" : "text-white/35 hover:text-white/60")}
                  style={doc.id === activeDocId ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}>
                  {doc.title.length > 20 ? doc.title.slice(0, 20) + "..." : doc.title}
                </button>
              ))}
            </div>
          )}

          {/* Download */}
          {activeDoc?.pdf_path && (
            <Button variant="ghost" size="sm" asChild className="gap-1.5 text-white/40 hover:text-white/70 hover:bg-white/[0.04]">
              <a href={activeDoc.pdf_path} download target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" /> PDF
              </a>
            </Button>
          )}

          {/* Chat toggle */}
          <Button variant="outline" size="sm" onClick={() => setChatOpen(!chatOpen)}
            className="gap-2 border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]">
            <MessageSquare className="h-3.5 w-3.5" /> {chatOpen ? "Close" : "Chat"}
          </Button>
        </div>
      </nav>

      {/* Layout: content + chat panel */}
      <div className="flex">
        {/* Main content */}
        <main className={cn("mx-auto max-w-4xl flex-1 px-6 pt-16 transition-all duration-300", chatOpen && "mr-[420px]")}>
          {sections.map((section) => {
            switch (section.type) {
              case "hero": return <HeroSection key={section.id} title={section.title ?? portal.title} clientName={section.content} brandColor={brandColor} logoUrl={portal.logo_url} subtitle={portal.subtitle} />;
              case "heading": return <HeadingSection key={section.id} section={section} brandColor={brandColor} />;
              case "paragraph": return <ParagraphSection key={section.id} section={section} brandColor={brandColor} />;
              case "list": return <ListSection key={section.id} section={section} brandColor={brandColor} />;
              case "phase-timeline": return <PhaseTimeline key={section.id} section={section} brandColor={brandColor} />;
              case "budget-table": return <BudgetSection key={section.id} section={section} brandColor={brandColor} />;
              case "milestone-timeline": return <MilestoneTimeline key={section.id} section={section} brandColor={brandColor} />;
              case "divider": return <div key={section.id} className="my-16"><div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}20, transparent)` }} /></div>;
              default: return null;
            }
          })}
          <footer className="flex flex-col items-center gap-6 py-24 text-center">
            <div className="h-px w-32" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}30, transparent)` }} />
            {portal.logo_url && <img src={portal.logo_url} alt="" className="h-8 w-auto opacity-40" />}
            <p className="text-xs text-white/20">Prepared by Mirror Factory for {portal.client_name ?? "Client"}</p>
          </footer>
        </main>

        {/* Chat side panel — real ChatInterface */}
        <aside className={cn(
          "fixed right-0 top-[49px] bottom-0 z-40 w-[420px] border-l border-white/[0.06] bg-[#070709]/95 backdrop-blur-xl transition-transform duration-300",
          chatOpen ? "translate-x-0" : "translate-x-full"
        )}>
          {chatOpen && (
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
          )}
        </aside>
      </div>

      {/* Chat FAB (when panel closed) */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
          style={{ backgroundColor: brandColor, boxShadow: `0 8px 32px ${brandColor}40` }}>
          <MessageSquare className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
  );
}
