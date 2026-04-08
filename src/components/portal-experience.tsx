"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  BarChart3,
  ChevronDown,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalData } from "@/app/portal/[token]/page";

// ---------------------------------------------------------------------------
// Document Section Parser
// ---------------------------------------------------------------------------

interface DocSection {
  id: string;
  type: "hero" | "heading" | "paragraph" | "list" | "data-table" | "kpi" | "divider";
  level?: number;
  title?: string;
  content: string;
  items?: string[];
  /** Detected numeric data for potential chart rendering */
  chartData?: { labels: string[]; values: number[]; type: "bar" | "pie" | "doughnut" };
}

function parseDocument(content: string, portalTitle: string, clientName: string): DocSection[] {
  if (!content) return [];

  const lines = content.split("\n");
  const sections: DocSection[] = [];
  let sectionIdx = 0;

  // Hero section is always first
  sections.push({
    id: "hero",
    type: "hero",
    title: portalTitle,
    content: clientName,
  });

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i].trim();

    // Skip empty lines
    if (!raw) {
      i++;
      continue;
    }

    // Markdown headings
    const headingMatch = raw.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      sectionIdx++;
      sections.push({
        id: `s-${sectionIdx}`,
        type: "heading",
        level: headingMatch[1].length,
        title: headingMatch[2].replace(/\*\*/g, ""),
        content: "",
      });
      i++;
      continue;
    }

    // Numbered headings: "1. Title", "2.1 Title"
    const numberedMatch = raw.match(/^(\d+(?:\.\d+)*)\s*[.)\-:]?\s+([A-Z].{1,80})/);
    if (numberedMatch && !raw.includes(". ") || (numberedMatch && raw.length < 80)) {
      sectionIdx++;
      const dots = (numberedMatch[1].match(/\./g) || []).length;
      sections.push({
        id: `s-${sectionIdx}`,
        type: "heading",
        level: dots + 1,
        title: numberedMatch[2].replace(/\*\*/g, ""),
        content: "",
      });
      i++;
      continue;
    }

    // List items — collect consecutive ones
    if (raw.startsWith("- ") || raw.startsWith("* ") || raw.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("- ") || l.startsWith("* ")) {
          items.push(l.slice(2).replace(/\*\*/g, ""));
        } else if (l.match(/^\d+\.\s/)) {
          items.push(l.replace(/^\d+\.\s*/, "").replace(/\*\*/g, ""));
        } else {
          break;
        }
        i++;
      }
      sectionIdx++;

      // Detect KPI-style lists: items with ":" separating label/value
      const kpiItems = items.filter((it) => it.includes(":"));
      if (kpiItems.length >= 2 && kpiItems.length === items.length) {
        // Try to extract numbers for chart data
        const labels: string[] = [];
        const values: number[] = [];
        for (const it of items) {
          const [label, ...rest] = it.split(":");
          const valStr = rest.join(":").trim();
          const num = parseFloat(valStr.replace(/[$,% ]/g, ""));
          labels.push(label.trim());
          if (!isNaN(num)) values.push(num);
        }

        sections.push({
          id: `s-${sectionIdx}`,
          type: "kpi",
          content: "",
          items,
          chartData:
            values.length >= 2
              ? { labels, values, type: values.length <= 6 ? "doughnut" : "bar" }
              : undefined,
        });
      } else {
        sections.push({
          id: `s-${sectionIdx}`,
          type: "list",
          content: "",
          items,
        });
      }
      continue;
    }

    // Table detection (markdown table with | separators)
    if (raw.includes("|") && raw.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      sectionIdx++;
      sections.push({
        id: `s-${sectionIdx}`,
        type: "data-table",
        content: tableLines.join("\n"),
      });
      continue;
    }

    // Divider
    if (raw.match(/^[-=_*]{3,}$/)) {
      sections.push({ id: `div-${sectionIdx}`, type: "divider", content: "" });
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("* ") && !lines[i].trim().startsWith("|")) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      sectionIdx++;
      sections.push({
        id: `s-${sectionIdx}`,
        type: "paragraph",
        content: paraLines.join(" ").replace(/\*\*/g, ""),
      });
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Scroll-triggered animation hook
// ---------------------------------------------------------------------------

function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// ---------------------------------------------------------------------------
// AI Hover Action Bar
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
            messages: [
              {
                id: crypto.randomUUID(),
                role: "user",
                parts: [{ type: "text", text: prompt }],
                createdAt: new Date(),
              },
            ],
          }),
        });

        if (!res.ok) {
          onResult("Unable to get AI response.");
          return;
        }

        // Read stream — collect text parts
        const reader = res.body?.getReader();
        if (!reader) {
          onResult("Unable to read response.");
          return;
        }

        const decoder = new TextDecoder();
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Extract text from stream protocol lines
          for (const line of chunk.split("\n")) {
            if (line.startsWith("g:")) {
              try {
                const parsed = JSON.parse(line.slice(2));
                if (typeof parsed === "string") text += parsed;
              } catch {
                // skip non-JSON lines
              }
            }
          }
        }
        onResult(text || "No response generated.");
      } catch {
        onResult("AI request failed.");
      } finally {
        setLoading(false);
      }
    },
    [shareToken, onResult]
  );

  const actions = [
    {
      icon: RefreshCw,
      label: "Re-explain",
      prompt: `Re-explain this section in simpler terms, be concise (2-3 sentences):\n\n${sectionText}`,
    },
    {
      icon: BarChart3,
      label: "Visualize",
      prompt: `Create a chart visualization for this data. Use the render_chart tool:\n\n${sectionText}`,
    },
    {
      icon: Lightbulb,
      label: "Key insight",
      prompt: `What is the single most important takeaway from this section? One sentence:\n\n${sectionText}`,
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/90 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: brandColor }} />
          <span className="text-xs text-white/60">Thinking...</span>
        </div>
      ) : (
        actions.map((action) => (
          <button
            key={action.label}
            onClick={() => askAi(action.prompt)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Components
// ---------------------------------------------------------------------------

function HeroSection({
  title,
  clientName,
  brandColor,
  subtitle,
}: {
  title: string;
  clientName: string;
  brandColor: string;
  subtitle: string | null;
}) {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div ref={ref} className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${brandColor}40 0%, transparent 70%)`,
        }}
      />
      {/* Animated grid lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(${brandColor} 1px, transparent 1px), linear-gradient(90deg, ${brandColor} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      <div
        className={cn(
          "relative z-10 flex max-w-4xl flex-col items-center gap-6 text-center transition-all duration-1000",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        )}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wider uppercase"
          style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Interactive Proposal
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          {title}
        </h1>

        <p className="max-w-2xl text-lg text-white/50">
          {subtitle || `Prepared for ${clientName}`}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div
            className="h-1 w-16 rounded-full"
            style={{ backgroundColor: brandColor }}
          />
          <span className="text-sm text-white/30">Scroll to explore</span>
          <div
            className="h-1 w-16 rounded-full"
            style={{ backgroundColor: brandColor }}
          />
        </div>

        <ChevronDown
          className="mt-8 h-6 w-6 animate-bounce text-white/20"
        />
      </div>
    </div>
  );
}

function HeadingSection({
  section,
  brandColor,
}: {
  section: DocSection;
  brandColor: string;
}) {
  const { ref, isVisible } = useScrollAnimation();
  const level = section.level ?? 1;

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        level === 1 && "mb-8 mt-20",
        level === 2 && "mb-6 mt-14",
        level >= 3 && "mb-4 mt-10"
      )}
    >
      {level === 1 && (
        <div
          className="mb-4 h-1 w-12 rounded-full"
          style={{ backgroundColor: brandColor }}
        />
      )}
      {level === 1 ? (
        <h2 className="text-3xl font-bold text-white sm:text-4xl">{section.title}</h2>
      ) : level === 2 ? (
        <h3 className="text-2xl font-semibold text-white">{section.title}</h3>
      ) : (
        <h4 className="text-xl font-medium text-white/90">{section.title}</h4>
      )}
    </div>
  );
}

function ParagraphSection({
  section,
  brandColor,
  shareToken,
}: {
  section: DocSection;
  brandColor: string;
  shareToken: string;
}) {
  const { ref, isVisible } = useScrollAnimation();
  const [hovered, setHovered] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative my-4 transition-all duration-700",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p className="text-base leading-relaxed text-white/60 transition-colors group-hover:text-white/80">
        {section.content}
      </p>

      {/* AI action bar on hover */}
      {hovered && (
        <div className="absolute -top-10 left-0 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
          <AiActionBar
            sectionText={section.content}
            shareToken={shareToken}
            brandColor={brandColor}
            onResult={setAiResult}
          />
        </div>
      )}

      {/* AI result */}
      {aiResult && (
        <div
          className="mt-3 rounded-xl border px-4 py-3 text-sm text-white/70 animate-in slide-in-from-top-2 duration-300"
          style={{ borderColor: `${brandColor}30`, backgroundColor: `${brandColor}08` }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: brandColor }}>
              <Sparkles className="h-3 w-3" /> AI Insight
            </span>
            <button onClick={() => setAiResult(null)} className="text-white/30 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {aiResult}
        </div>
      )}
    </div>
  );
}

function ListSection({
  section,
  brandColor,
}: {
  section: DocSection;
  brandColor: string;
}) {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div
      ref={ref}
      className={cn(
        "my-6 transition-all duration-700",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
    >
      <ul className="space-y-3">
        {(section.items ?? []).map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 text-white/60 transition-all duration-500"
            style={{
              transitionDelay: isVisible ? `${idx * 80}ms` : "0ms",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateX(0)" : "translateX(-12px)",
            }}
          >
            <div
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: brandColor }}
            />
            <span className="text-sm leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KpiSection({
  section,
  brandColor,
  shareToken,
}: {
  section: DocSection;
  brandColor: string;
  shareToken: string;
}) {
  const { ref, isVisible } = useScrollAnimation();
  const [showChart, setShowChart] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const kpis = (section.items ?? []).map((item) => {
    const colonIdx = item.indexOf(":");
    if (colonIdx === -1) return { label: item, value: "" };
    return {
      label: item.slice(0, colonIdx).trim(),
      value: item.slice(colonIdx + 1).trim(),
    };
  });

  return (
    <div
      ref={ref}
      className={cn(
        "my-8 transition-all duration-700",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="group/card relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
            style={{
              transitionDelay: isVisible ? `${idx * 100}ms` : "0ms",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              {kpi.label}
            </p>
            <p className="mt-1 text-lg font-bold text-white">{kpi.value}</p>
            <div
              className="absolute bottom-0 left-0 h-0.5 w-full opacity-0 transition-opacity group-hover/card:opacity-100"
              style={{ backgroundColor: brandColor }}
            />
          </div>
        ))}
      </div>

      {/* Chart toggle */}
      {section.chartData && (
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="gap-2 border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05] hover:text-white"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {showChart ? "Hide chart" : "Visualize"}
          </Button>
        </div>
      )}

      {/* Inline chart */}
      {showChart && section.chartData && (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-6 animate-in slide-in-from-top-2 duration-300">
          <InlineChart chartData={section.chartData} brandColor={brandColor} />
        </div>
      )}

      {/* AI action bar */}
      {hovered && (
        <div className="mt-3 animate-in fade-in-0 duration-150">
          <AiActionBar
            sectionText={(section.items ?? []).join("\n")}
            shareToken={shareToken}
            brandColor={brandColor}
            onResult={setAiResult}
          />
        </div>
      )}

      {aiResult && (
        <div
          className="mt-3 rounded-xl border px-4 py-3 text-sm text-white/70 animate-in slide-in-from-top-2 duration-300"
          style={{ borderColor: `${brandColor}30`, backgroundColor: `${brandColor}08` }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: brandColor }}>
              <Sparkles className="h-3 w-3" /> AI Insight
            </span>
            <button onClick={() => setAiResult(null)} className="text-white/30 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {aiResult}
        </div>
      )}
    </div>
  );
}

function DataTableSection({
  section,
  brandColor,
}: {
  section: DocSection;
  brandColor: string;
}) {
  const { ref, isVisible } = useScrollAnimation();

  const rows = section.content
    .split("\n")
    .filter((line) => !line.match(/^\|[\s-|]+\|$/))
    .map((line) =>
      line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) return null;
  const headers = rows[0];
  const body = rows.slice(1);

  return (
    <div
      ref={ref}
      className={cn(
        "my-8 overflow-hidden rounded-xl border border-white/5 transition-all duration-700",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: `${brandColor}10` }}>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/60">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ridx) => (
              <tr
                key={ridx}
                className="border-t border-white/5 transition-colors hover:bg-white/[0.02]"
                style={{
                  transitionDelay: isVisible ? `${ridx * 50}ms` : "0ms",
                  opacity: isVisible ? 1 : 0,
                }}
              >
                {row.map((cell, cidx) => (
                  <td key={cidx} className="px-4 py-3 text-white/60">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Chart.js (loaded via script tag inside iframe)
// ---------------------------------------------------------------------------

function InlineChart({
  chartData,
  brandColor,
}: {
  chartData: { labels: string[]; values: number[]; type: "bar" | "pie" | "doughnut" };
  brandColor: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const colors = useMemo(() => {
    const base = brandColor;
    // Generate palette from brand color with varying opacity
    return chartData.labels.map(
      (_, i) => `${base}${Math.round(((i + 1) / chartData.labels.length) * 200 + 55).toString(16).padStart(2, "0")}`
    );
  }, [brandColor, chartData.labels]);

  const config = JSON.stringify({
    type: chartData.type,
    data: {
      labels: chartData.labels,
      datasets: [
        {
          data: chartData.values,
          backgroundColor: colors,
          borderColor: "transparent",
          borderWidth: 0,
          borderRadius: chartData.type === "bar" ? 6 : 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 1200, easing: "easeOutQuart" },
      plugins: {
        legend: {
          position: chartData.type === "bar" ? "top" : "right",
          labels: { color: "rgba(255,255,255,0.6)", font: { size: 11 } },
        },
      },
      scales:
        chartData.type === "bar"
          ? {
              x: { ticks: { color: "rgba(255,255,255,0.4)" }, grid: { color: "rgba(255,255,255,0.05)" } },
              y: { ticks: { color: "rgba(255,255,255,0.4)" }, grid: { color: "rgba(255,255,255,0.05)" } },
            }
          : undefined,
    },
  });

  const html = `<!DOCTYPE html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>body{margin:0;background:transparent;display:flex;justify-content:center;align-items:center;min-height:100%}</style>
</head><body>
<canvas id="c" style="max-height:300px"></canvas>
<script>new Chart(document.getElementById('c'),${config})</script>
</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      className="h-[300px] w-full border-0 bg-transparent"
      sandbox="allow-scripts"
      title="Chart visualization"
    />
  );
}

// ---------------------------------------------------------------------------
// Chat Drawer (mini-chat for the experience)
// ---------------------------------------------------------------------------

function ChatDrawer({
  open,
  onClose,
  shareToken,
  brandColor,
}: {
  open: boolean;
  onClose: () => void;
  shareToken: string;
  brandColor: string;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [{ type: "text", text: userMsg }],
              createdAt: new Date(),
            },
          ],
        }),
      });

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: "Unable to respond right now." }]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("g:")) {
            try {
              const parsed = JSON.parse(line.slice(2));
              if (typeof parsed === "string") text += parsed;
            } catch {
              // skip
            }
          }
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", text: text || "No response." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Request failed." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, shareToken]);

  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-96 max-w-[calc(100vw-48px)] rounded-2xl border border-white/10 bg-[#0a0a0f]/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <span className="text-sm font-medium text-white/80">Ask about this document</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/70">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="max-h-64 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-white/30">Ask anything about the proposal...</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              msg.role === "user"
                ? "ml-8 bg-white/5 text-white/80"
                : "mr-8 text-white/60"
            )}
            style={msg.role === "assistant" ? { backgroundColor: `${brandColor}08` } : undefined}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a question..."
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/30 outline-none"
          />
          <Button
            size="sm"
            onClick={send}
            disabled={loading || !input.trim()}
            className="h-7 px-3 text-xs text-white"
            style={{ backgroundColor: brandColor }}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Experience Component
// ---------------------------------------------------------------------------

export function PortalExperience({ portal }: { portal: PortalData }) {
  const [chatOpen, setChatOpen] = useState(false);
  const brandColor = portal.brand_color || "#34d399";

  // Get active document content — prefer active doc, fallback to portal.document_content
  const activeDoc = portal.documents?.find((d) => d.is_active) ?? portal.documents?.[0];
  const content = activeDoc?.content ?? portal.document_content ?? "";

  const sections = useMemo(
    () => parseDocument(content, portal.title, portal.client_name ?? "Client"),
    [content, portal.title, portal.client_name]
  );

  return (
    <div className="min-h-screen bg-[#050508]">
      {/* Top nav bar */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/5 bg-[#050508]/80 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div
            className="h-6 w-6 rounded-md"
            style={{ backgroundColor: brandColor }}
          />
          <span className="text-sm font-medium text-white/80">{portal.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Document switcher */}
          {portal.documents && portal.documents.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] px-1 py-0.5">
              {portal.documents.map((doc) => (
                <span
                  key={doc.id}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors",
                    doc.is_active
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/40 hover:text-white/60"
                  )}
                >
                  {doc.title}
                </span>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setChatOpen(!chatOpen)}
            className="gap-2 border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </Button>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-6 pt-16">
        {sections.map((section) => {
          switch (section.type) {
            case "hero":
              return (
                <HeroSection
                  key={section.id}
                  title={section.title ?? portal.title}
                  clientName={section.content}
                  brandColor={brandColor}
                  subtitle={portal.subtitle}
                />
              );
            case "heading":
              return (
                <HeadingSection
                  key={section.id}
                  section={section}
                  brandColor={brandColor}
                />
              );
            case "paragraph":
              return (
                <ParagraphSection
                  key={section.id}
                  section={section}
                  brandColor={brandColor}
                  shareToken={portal.share_token}
                />
              );
            case "list":
              return (
                <ListSection
                  key={section.id}
                  section={section}
                  brandColor={brandColor}
                />
              );
            case "kpi":
              return (
                <KpiSection
                  key={section.id}
                  section={section}
                  brandColor={brandColor}
                  shareToken={portal.share_token}
                />
              );
            case "data-table":
              return (
                <DataTableSection
                  key={section.id}
                  section={section}
                  brandColor={brandColor}
                />
              );
            case "divider":
              return (
                <div key={section.id} className="my-12 border-t border-white/5" />
              );
            default:
              return null;
          }
        })}

        {/* Footer */}
        <footer className="flex flex-col items-center gap-4 py-24 text-center">
          <div
            className="h-1 w-16 rounded-full"
            style={{ backgroundColor: brandColor }}
          />
          <p className="text-sm text-white/30">
            Prepared by Mirror Factory for {portal.client_name ?? "Client"}
          </p>
        </footer>
      </main>

      {/* Floating chat button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-105"
          style={{ backgroundColor: brandColor }}
        >
          <MessageSquare className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Chat drawer */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        shareToken={portal.share_token}
        brandColor={brandColor}
      />
    </div>
  );
}
