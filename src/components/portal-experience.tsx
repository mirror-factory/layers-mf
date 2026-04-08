"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalData, PortalDocument } from "@/app/portal/[token]/page";

// ---------------------------------------------------------------------------
// Document Section Types
// ---------------------------------------------------------------------------

interface DocSection {
  id: string;
  type:
    | "hero"
    | "heading"
    | "paragraph"
    | "list"
    | "phase-timeline"
    | "budget-table"
    | "milestone-timeline"
    | "kpi"
    | "divider";
  level?: number;
  title?: string;
  content: string;
  items?: string[];
  phases?: { name: string; timeline: string; description: string; investment?: string }[];
  budgetRows?: { phase: string; timeline: string; investment: string }[];
  milestones?: { phase: string; dates: string; milestones: string }[];
}

// ---------------------------------------------------------------------------
// Smart Document Parser — detects phases, budgets, milestones
// ---------------------------------------------------------------------------

function parseDocument(
  content: string,
  portalTitle: string,
  clientName: string
): DocSection[] {
  if (!content) return [];

  const lines = content.split("\n");
  const sections: DocSection[] = [];
  let idx = 0;

  sections.push({
    id: "hero",
    type: "hero",
    title: portalTitle,
    content: clientName,
  });

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i].trim();
    if (!raw) { i++; continue; }

    // Skip metadata header lines (Prepared by, Revision, Date, etc.)
    if (/^(Prepared (by|for)|Date:|Revision:)/i.test(raw)) { i++; continue; }
    // Skip the "CompanyA x CompanyB" header
    if (/\bx\b/.test(raw) && raw.length < 80 && i < 10) { i++; continue; }

    // Detect phase blocks: "Phase N: Title (duration)" followed by description paragraphs
    const phaseHeaderMatch = raw.match(/^Phase\s+(\d+)[\s:]+(.+)/i);
    if (phaseHeaderMatch) {
      const phases: DocSection["phases"] = [];
      // Collect consecutive phase blocks
      let j = i;
      while (j < lines.length) {
        const pLine = lines[j].trim();
        const pm = pLine.match(/^Phase\s+(\d+)[\s:]+(.+)/i);
        if (!pm && phases.length > 0) break;
        if (pm) {
          // Collect description lines after the phase header
          j++;
          const descLines: string[] = [];
          while (j < lines.length) {
            const dl = lines[j].trim();
            if (!dl || dl.match(/^Phase\s+\d+/i) || dl.match(/^\d+\.\s/) || dl.match(/^#{1,4}\s/)) break;
            descLines.push(dl);
            j++;
          }
          phases.push({
            name: `Phase ${pm[1]}`,
            timeline: pm[2].replace(/[()]/g, "").trim(),
            description: descLines.join(" "),
          });
        } else {
          j++;
        }
      }
      if (phases.length >= 2) {
        idx++;
        sections.push({ id: `s-${idx}`, type: "phase-timeline", content: "", phases });
        i = j;
        continue;
      }
    }

    // Detect budget table pattern: Phase / Timeline / Investment header
    if (
      /^Phase$/i.test(raw) &&
      i + 1 < lines.length && /timeline/i.test(lines[i + 1].trim()) &&
      i + 2 < lines.length && /investment/i.test(lines[i + 2].trim())
    ) {
      // Read rows: groups of 3 lines (phase, timeline, investment)
      const budgetRows: DocSection["budgetRows"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = lines[j].trim();
        const t = lines[j + 1].trim();
        const inv = lines[j + 2].trim();
        if (!p || p.match(/^(Phase\s*$|Timeline|Milestones)/i)) break;
        budgetRows.push({ phase: p, timeline: t, investment: inv });
        j += 3;
      }
      if (budgetRows.length > 0) {
        idx++;
        sections.push({ id: `s-${idx}`, type: "budget-table", content: "", budgetRows });
        i = j;
        continue;
      }
    }

    // Detect milestone table: Phase / Target Dates / Key Milestones
    if (
      /^Phase$/i.test(raw) &&
      i + 1 < lines.length && /target dates/i.test(lines[i + 1].trim()) &&
      i + 2 < lines.length && /key milestones/i.test(lines[i + 2].trim())
    ) {
      const milestones: DocSection["milestones"] = [];
      let j = i + 3;
      while (j + 2 < lines.length) {
        const p = lines[j].trim();
        const d = lines[j + 1].trim();
        const m = lines[j + 2].trim();
        if (!p || /^(Timeline|Phase\s*$)/i.test(p)) break;
        milestones.push({ phase: p, dates: d, milestones: m });
        j += 3;
      }
      if (milestones.length > 0) {
        idx++;
        sections.push({ id: `s-${idx}`, type: "milestone-timeline", content: "", milestones });
        i = j;
        continue;
      }
    }

    // Numbered headings: "1. Title", "2. Goals"
    const numberedMatch = raw.match(/^(\d+)\.\s+(.{2,100})/);
    if (numberedMatch && raw.length < 100) {
      idx++;
      sections.push({
        id: `s-${idx}`,
        type: "heading",
        level: 1,
        title: numberedMatch[2].replace(/\*\*/g, ""),
        content: "",
      });
      i++;
      continue;
    }

    // Markdown headings
    const headingMatch = raw.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      idx++;
      sections.push({
        id: `s-${idx}`,
        type: "heading",
        level: headingMatch[1].length,
        title: headingMatch[2].replace(/\*\*/g, ""),
        content: "",
      });
      i++;
      continue;
    }

    // Sub-headings (bold or title-case short lines that aren't sentences)
    if (raw.length < 60 && !raw.includes(".") && /^[A-Z]/.test(raw) && !/^(Phase|The|A |An |In |On |At |By |To |If )/.test(raw)) {
      idx++;
      sections.push({
        id: `s-${idx}`,
        type: "heading",
        level: 3,
        title: raw.replace(/\*\*/g, ""),
        content: "",
      });
      i++;
      continue;
    }

    // List items
    if (raw.startsWith("- ") || raw.startsWith("* ") || raw.match(/^[a-z]\.\s/)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("- ") || l.startsWith("* ")) {
          items.push(l.slice(2).replace(/\*\*/g, ""));
        } else if (l.match(/^[a-z]\.\s/)) {
          items.push(l.replace(/^[a-z]\.\s*/, "").replace(/\*\*/g, ""));
        } else {
          break;
        }
        i++;
      }
      idx++;
      sections.push({ id: `s-${idx}`, type: "list", content: "", items });
      continue;
    }

    // Divider
    if (raw.match(/^[-=_*]{3,}$/)) {
      sections.push({ id: `div-${idx}`, type: "divider", content: "" });
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ") && !lines[i].trim().match(/^\d+\.\s+[A-Z]/)) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      idx++;
      sections.push({
        id: `s-${idx}`,
        type: "paragraph",
        content: paraLines.join(" ").replace(/\*\*/g, ""),
      });
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Scroll-triggered animation
// ---------------------------------------------------------------------------

function useScrollAnimation(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => setIsVisible(true), delay);
          } else {
            setIsVisible(true);
          }
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return { ref, isVisible };
}

// ---------------------------------------------------------------------------
// AI Action Bar
// ---------------------------------------------------------------------------

function AiActionBar({
  sectionText,
  shareToken,
  brandColor,
  onResult,
}: {
  sectionText: string;
  shareToken: string;
  brandColor: string;
  onResult: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const askAi = useCallback(
    async (prompt: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/chat/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            share_token: shareToken,
            messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: prompt }], createdAt: new Date() }],
          }),
        });
        if (!res.ok) { onResult("Unable to get AI response."); return; }
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            // AI SDK v6 stream: try 0: (text delta) and g: formats
            for (const prefix of ["0:", "g:"]) {
              if (line.startsWith(prefix)) {
                try {
                  const parsed = JSON.parse(line.slice(prefix.length));
                  if (typeof parsed === "string") text += parsed;
                } catch { /* skip */ }
              }
            }
          }
        }
        onResult(text || "No response generated.");
      } catch { onResult("AI request failed."); }
      finally { setLoading(false); }
    },
    [shareToken, onResult]
  );

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/90 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: brandColor }} />
          <span className="text-xs text-white/60">Thinking...</span>
        </div>
      ) : (
        [
          { icon: RefreshCw, label: "Re-explain", prompt: `Re-explain this section in simpler terms, 2-3 sentences:\n\n${sectionText}` },
          { icon: Lightbulb, label: "Key insight", prompt: `Single most important takeaway from this section, one sentence:\n\n${sectionText}` },
        ].map((a) => (
          <button key={a.label} onClick={() => askAi(a.prompt)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white">
            <a.icon className="h-3.5 w-3.5" /> {a.label}
          </button>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

function HeroSection({ title, clientName, brandColor, logoUrl, subtitle }: {
  title: string; clientName: string; brandColor: string; logoUrl: string | null; subtitle: string | null;
}) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div ref={ref} className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/* Animated radial glow */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${brandColor}18 0%, transparent 70%)`,
      }} />
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: `linear-gradient(${brandColor}60 1px, transparent 1px), linear-gradient(90deg, ${brandColor}60 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
      }} />
      {/* Animated wave accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{
        background: `linear-gradient(90deg, transparent, ${brandColor}40, transparent)`,
      }} />

      <div className={cn(
        "relative z-10 flex max-w-4xl flex-col items-center gap-8 text-center transition-all duration-1000 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
      )}>
        {/* Logo */}
        {logoUrl && (
          <img src={logoUrl} alt={`${clientName} logo`} className="h-14 w-auto opacity-90" />
        )}

        <div className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-medium tracking-widest uppercase"
          style={{ borderColor: `${brandColor}30`, color: brandColor, backgroundColor: `${brandColor}08` }}>
          <Sparkles className="h-3.5 w-3.5" />
          Interactive Proposal
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl" style={{
          background: `linear-gradient(135deg, #ffffff 40%, ${brandColor} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {title.replace(/Scope of Work —\s*/i, "").replace(/Proposal —\s*/i, "")}
        </h1>

        <p className="max-w-2xl text-lg text-white/40">
          {subtitle || `Prepared exclusively for ${clientName}`}
        </p>

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

// ---------------------------------------------------------------------------
// Section Heading
// ---------------------------------------------------------------------------

function HeadingSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const level = section.level ?? 1;
  return (
    <div ref={ref} className={cn(
      "transition-all duration-700",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      level === 1 && "mb-6 mt-24",
      level === 2 && "mb-4 mt-16",
      level >= 3 && "mb-3 mt-10"
    )}>
      {level === 1 && (
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${brandColor}40, transparent)` }} />
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
            <Zap className="h-4 w-4" style={{ color: brandColor }} />
          </div>
          <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${brandColor}40, transparent)` }} />
        </div>
      )}
      {level === 1 ? (
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">{section.title}</h2>
      ) : level === 2 ? (
        <h3 className="text-2xl font-semibold text-white/90">{section.title}</h3>
      ) : (
        <h4 className="text-lg font-semibold text-white/70 tracking-wide uppercase" style={{ color: `${brandColor}cc` }}>{section.title}</h4>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paragraph in glass card
// ---------------------------------------------------------------------------

function ParagraphSection({ section, brandColor, shareToken }: {
  section: DocSection; brandColor: string; shareToken: string;
}) {
  const { ref, isVisible } = useScrollAnimation();
  const [hovered, setHovered] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Long paragraphs get a card treatment, short ones are inline
  const isLong = section.content.length > 200;

  return (
    <div ref={ref} className={cn(
      "group relative my-4 transition-all duration-700",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    )} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {isLong ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.03]"
          style={{ boxShadow: hovered ? `0 0 40px ${brandColor}08` : "none" }}>
          <p className="text-[15px] leading-[1.8] text-white/55 transition-colors group-hover:text-white/70">
            {section.content}
          </p>
        </div>
      ) : (
        <p className="text-[15px] leading-[1.8] text-white/55 transition-colors group-hover:text-white/70">
          {section.content}
        </p>
      )}

      {hovered && !aiResult && (
        <div className="absolute -top-10 left-0 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
          <AiActionBar sectionText={section.content} shareToken={shareToken} brandColor={brandColor} onResult={setAiResult} />
        </div>
      )}

      {aiResult && (
        <div className="mt-3 rounded-xl border px-4 py-3 text-sm leading-relaxed text-white/60 animate-in slide-in-from-top-2 duration-300"
          style={{ borderColor: `${brandColor}25`, backgroundColor: `${brandColor}06` }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: brandColor }}>
              <Sparkles className="h-3 w-3" /> AI Insight
            </span>
            <button onClick={() => setAiResult(null)} className="text-white/30 hover:text-white/60"><X className="h-3.5 w-3.5" /></button>
          </div>
          {aiResult}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature List with icons
// ---------------------------------------------------------------------------

function ListSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div ref={ref} className={cn(
      "my-6 grid gap-3 sm:grid-cols-2 transition-all duration-700",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    )}>
      {(section.items ?? []).map((item, i) => (
        <div key={i}
          className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.03]"
          style={{
            transitionDelay: isVisible ? `${i * 60}ms` : "0ms",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(8px)",
          }}>
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brandColor }} />
          <span className="text-sm leading-relaxed text-white/60">{item}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase Timeline — the showpiece
// ---------------------------------------------------------------------------

function PhaseTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const phases = section.phases ?? [];

  const phaseIcons = [Target, Zap, Sparkles, BarChart3];

  return (
    <div ref={ref} className={cn(
      "my-12 transition-all duration-700",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
    )}>
      {/* Connected timeline */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-6 top-0 bottom-0 w-px sm:left-1/2 sm:-translate-x-px"
          style={{ background: `linear-gradient(180deg, transparent, ${brandColor}40, ${brandColor}40, transparent)` }} />

        <div className="space-y-8">
          {phases.map((phase, i) => {
            const Icon = phaseIcons[i % phaseIcons.length];
            const isLeft = i % 2 === 0;
            return (
              <div key={i}
                className="relative transition-all duration-700"
                style={{
                  transitionDelay: isVisible ? `${i * 200}ms` : "0ms",
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                }}>
                {/* Node dot */}
                <div className="absolute left-6 top-6 z-10 -translate-x-1/2 sm:left-1/2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2"
                    style={{ borderColor: brandColor, backgroundColor: `${brandColor}15` }}>
                    <Icon className="h-5 w-5" style={{ color: brandColor }} />
                  </div>
                </div>

                {/* Card */}
                <div className={cn(
                  "ml-16 sm:ml-0 sm:w-[calc(50%-40px)]",
                  isLeft ? "sm:mr-auto" : "sm:ml-auto"
                )}>
                  <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
                    style={{ boxShadow: `inset 0 1px 0 ${brandColor}10` }}>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="text-lg font-bold text-white">{phase.name}</span>
                    </div>
                    <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: `${brandColor}cc` }}>
                      <Clock className="h-3 w-3" />
                      {phase.timeline}
                    </div>
                    {phase.investment && (
                      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ backgroundColor: `${brandColor}12`, color: brandColor }}>
                        <DollarSign className="h-3 w-3" />
                        {phase.investment}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-white/50 group-hover:text-white/65 transition-colors">
                      {phase.description.length > 300 ? phase.description.slice(0, 300) + "..." : phase.description}
                    </p>
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

// ---------------------------------------------------------------------------
// Budget Table — styled cards with amounts
// ---------------------------------------------------------------------------

function BudgetSection({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const rows = section.budgetRows ?? [];

  return (
    <div ref={ref} className={cn(
      "my-10 transition-all duration-700",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    )}>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row, i) => (
          <div key={i}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
            style={{
              transitionDelay: isVisible ? `${i * 150}ms` : "0ms",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
            }}>
            {/* Glow accent */}
            <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full opacity-0 transition-opacity group-hover:opacity-100 blur-2xl"
              style={{ backgroundColor: `${brandColor}20` }} />

            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">{row.phase.replace(/Phase \d+:\s*/i, "Phase " + (i + 1))}</p>

            <p className="text-3xl font-bold text-white mb-2" style={
              row.investment.startsWith("$") ? {
                background: `linear-gradient(135deg, #ffffff 30%, ${brandColor})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              } : {}
            }>
              {row.investment}
            </p>

            <div className="flex items-center gap-2 text-xs text-white/40">
              <Clock className="h-3 w-3" />
              {row.timeline}
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: `linear-gradient(90deg, transparent, ${brandColor}60, transparent)` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Milestone Timeline
// ---------------------------------------------------------------------------

function MilestoneTimeline({ section, brandColor }: { section: DocSection; brandColor: string }) {
  const { ref, isVisible } = useScrollAnimation();
  const milestones = section.milestones ?? [];

  return (
    <div ref={ref} className={cn(
      "my-10 transition-all duration-700",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    )}>
      <div className="space-y-4">
        {milestones.map((m, i) => (
          <div key={i}
            className="group flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
            style={{
              transitionDelay: isVisible ? `${i * 120}ms` : "0ms",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateX(0)" : "translateX(-12px)",
            }}>
            {/* Timeline dot */}
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="h-3 w-3 rounded-full border-2" style={{ borderColor: brandColor, backgroundColor: `${brandColor}30` }} />
              {i < milestones.length - 1 && <div className="flex-1 w-px" style={{ backgroundColor: `${brandColor}20` }} />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-semibold text-white">{m.phase}</span>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide"
                  style={{ backgroundColor: `${brandColor}12`, color: `${brandColor}cc` }}>
                  {m.dates}
                </span>
              </div>
              <p className="text-sm text-white/45 leading-relaxed group-hover:text-white/60 transition-colors">{m.milestones}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Drawer
// ---------------------------------------------------------------------------

function ChatDrawer({ open, onClose, shareToken, brandColor }: {
  open: boolean; onClose: () => void; shareToken: string; brandColor: string;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_token: shareToken,
          messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: userMsg }], createdAt: new Date() }],
        }),
      });
      if (!res.ok) { setMessages((p) => [...p, { role: "assistant", text: "Unable to respond." }]); return; }
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          for (const prefix of ["0:", "g:"]) {
            if (line.startsWith(prefix)) {
              try { const p = JSON.parse(line.slice(prefix.length)); if (typeof p === "string") text += p; } catch { /* skip */ }
            }
          }
        }
      }
      setMessages((p) => [...p, { role: "assistant", text: text || "No response." }]);
    } catch { setMessages((p) => [...p, { role: "assistant", text: "Request failed." }]); }
    finally { setLoading(false); }
  }, [input, loading, shareToken]);

  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-[400px] max-w-[calc(100vw-48px)] rounded-2xl border border-white/10 bg-[#0a0a0f]/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <span className="text-sm font-medium text-white/80">Ask about this proposal</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
      </div>
      <div ref={scrollRef} className="max-h-72 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-xs text-white/25 py-6">Ask anything about the proposal...</p>}
        {messages.map((msg, i) => (
          <div key={i} className={cn("rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            msg.role === "user" ? "ml-8 bg-white/5 text-white/80" : "mr-8 text-white/60"
          )} style={msg.role === "assistant" ? { backgroundColor: `${brandColor}06` } : undefined}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-xs text-white/40"><Loader2 className="h-3 w-3 animate-spin" /> Thinking...</div>}
      </div>
      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a question..." className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none" />
          <button onClick={send} disabled={loading || !input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            style={{ backgroundColor: brandColor }}>
            <Send className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PortalExperience({ portal }: { portal: PortalData }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(
    portal.documents?.find((d) => d.is_active)?.id ?? portal.documents?.[0]?.id ?? null
  );
  const brandColor = portal.brand_color || "#0DE4F2";

  const activeDoc = portal.documents?.find((d) => d.id === activeDocId) ?? portal.documents?.[0];
  const content = activeDoc?.content ?? portal.document_content ?? "";

  const sections = useMemo(
    () => parseDocument(content, activeDoc?.title ?? portal.title, portal.client_name ?? "Client"),
    [content, activeDoc?.title, portal.title, portal.client_name]
  );

  const handleDocSwitch = useCallback((doc: PortalDocument) => {
    setActiveDocId(doc.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Fixed top nav */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/[0.06] bg-[#050508]/80 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {portal.logo_url && <img src={portal.logo_url} alt="" className="h-6 w-auto opacity-80" />}
          {!portal.logo_url && <div className="h-6 w-6 rounded-md" style={{ backgroundColor: brandColor }} />}
          <span className="text-sm font-medium text-white/60">{portal.client_name}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Document tabs */}
          {portal.documents && portal.documents.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              {portal.documents.map((doc) => (
                <button key={doc.id} onClick={() => handleDocSwitch(doc)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs transition-all",
                    doc.id === activeDocId
                      ? "font-medium text-white"
                      : "text-white/35 hover:text-white/60"
                  )}
                  style={doc.id === activeDocId ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}>
                  {doc.title.length > 25 ? doc.title.slice(0, 25) + "..." : doc.title}
                </button>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => setChatOpen(!chatOpen)}
            className="gap-2 border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]">
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </Button>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 pt-16">
        {sections.map((section) => {
          switch (section.type) {
            case "hero":
              return <HeroSection key={section.id} title={section.title ?? portal.title} clientName={section.content}
                brandColor={brandColor} logoUrl={portal.logo_url} subtitle={portal.subtitle} />;
            case "heading":
              return <HeadingSection key={section.id} section={section} brandColor={brandColor} />;
            case "paragraph":
              return <ParagraphSection key={section.id} section={section} brandColor={brandColor} shareToken={portal.share_token} />;
            case "list":
              return <ListSection key={section.id} section={section} brandColor={brandColor} />;
            case "phase-timeline":
              return <PhaseTimeline key={section.id} section={section} brandColor={brandColor} />;
            case "budget-table":
              return <BudgetSection key={section.id} section={section} brandColor={brandColor} />;
            case "milestone-timeline":
              return <MilestoneTimeline key={section.id} section={section} brandColor={brandColor} />;
            case "divider":
              return <div key={section.id} className="my-16"><div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}20, transparent)` }} /></div>;
            default:
              return null;
          }
        })}

        {/* Footer */}
        <footer className="flex flex-col items-center gap-6 py-24 text-center">
          <div className="h-px w-32" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}30, transparent)` }} />
          {portal.logo_url && <img src={portal.logo_url} alt="" className="h-8 w-auto opacity-40" />}
          <p className="text-xs text-white/20">
            Prepared by Mirror Factory for {portal.client_name ?? "Client"}
          </p>
        </footer>
      </main>

      {/* Chat FAB */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
          style={{ backgroundColor: brandColor, boxShadow: `0 8px 32px ${brandColor}40` }}>
          <MessageSquare className="h-5 w-5 text-white" />
        </button>
      )}

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} shareToken={portal.share_token} brandColor={brandColor} />
    </div>
  );
}
