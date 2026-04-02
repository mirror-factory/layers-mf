"use client";

import { NeuralDots } from "@/components/ui/neural-dots";
import { Entropy } from "@/components/ui/entropy";
import { Loader2 } from "lucide-react";

export default function EntropyShowcasePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-16">
      <div>
        <h1 className="text-2xl font-serif font-bold mb-2">Animation Showcase</h1>
        <p className="text-muted-foreground text-sm">NeuralDots — multi-layer SVG neural network animation for the Granger brand.</p>
      </div>

      {/* 1. AI Avatar sizes */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">1. AI Avatar — Sizes</h2>
        <div className="flex items-end gap-8">
          {[
            { s: 36, dots: 6, label: "Small (tool calls)" },
            { s: 48, dots: 8, label: "Medium (chat)" },
            { s: 64, dots: 10, label: "Large (chat)" },
            { s: 96, dots: 14, label: "XL (welcome)" },
            { s: 128, dots: 18, label: "2XL (hero)" },
          ].map(({ s, dots, label }) => (
            <div key={s} className="text-center space-y-2">
              <div className="rounded-full overflow-hidden ring-1 ring-primary/20 mx-auto" style={{ width: s, height: s }}>
                <NeuralDots size={s} dotCount={dots} />
              </div>
              <p className="text-[10px] text-muted-foreground">{s}px · {dots} dots</p>
              <p className="text-[10px] text-primary">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Chat message mockup */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">2. In Chat Messages</h2>
        <div className="max-w-lg space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full overflow-hidden ring-1 ring-primary/20 shrink-0" style={{ width: 44, height: 44 }}>
              <NeuralDots size={44} dotCount={8} />
            </div>
            <div className="text-sm pt-2">Here are your team metrics for this week. Everything looks on track with 12 tasks completed.</div>
          </div>
          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">A</div>
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm">Show me the breakdown by team</div>
          </div>
        </div>
      </section>

      {/* 3. Loading / Thinking states — ALL use the detailed format */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">3. Loading / Thinking States</h2>
        <p className="text-sm text-muted-foreground">All loading states use the detailed format with neural dots + status text.</p>
        <div className="space-y-4 max-w-md">
          {/* Thinking */}
          <div className="flex items-center gap-3">
            <div className="rounded-full overflow-hidden ring-1 ring-primary/10 shrink-0" style={{ width: 36, height: 36 }}>
              <NeuralDots size={36} dotCount={6} />
            </div>
            <div>
              <p className="text-sm text-foreground">Thinking…</p>
              <p className="text-[10px] text-muted-foreground">Processing your request</p>
            </div>
          </div>

          {/* Researching with tools */}
          <div className="flex items-center gap-3">
            <div className="rounded-full overflow-hidden ring-1 ring-primary/10 shrink-0" style={{ width: 36, height: 36 }}>
              <NeuralDots size={36} dotCount={6} />
            </div>
            <div>
              <p className="text-sm text-foreground">Researching your question</p>
              <p className="text-[10px] text-muted-foreground">Searching knowledge base, checking Linear…</p>
            </div>
          </div>

          {/* Building */}
          <div className="flex items-center gap-3">
            <div className="rounded-full overflow-hidden ring-1 ring-primary/10 shrink-0" style={{ width: 36, height: 36 }}>
              <NeuralDots size={36} dotCount={6} />
            </div>
            <div>
              <p className="text-sm text-foreground">Building your dashboard</p>
              <p className="text-[10px] text-muted-foreground">Installing packages, starting dev server…</p>
            </div>
          </div>

          {/* Analyzing */}
          <div className="flex items-center gap-3">
            <div className="rounded-full overflow-hidden ring-1 ring-primary/10 shrink-0" style={{ width: 36, height: 36 }}>
              <NeuralDots size={36} dotCount={6} />
            </div>
            <div>
              <p className="text-sm text-foreground">Analyzing document</p>
              <p className="text-[10px] text-muted-foreground">Reading content, extracting entities…</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Tool call indicator */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">4. Tool Call Indicators</h2>
        <div className="space-y-2 max-w-md">
          <div className="inline-flex items-center gap-2 text-xs">
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: 18, height: 18 }}>
              <NeuralDots size={18} dotCount={4} />
            </div>
            <span className="text-muted-foreground">Searching knowledge base</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-primary text-[10px]">&#10003;</span>
            <span className="text-muted-foreground">Checking Linear</span>
            <span className="text-primary text-[10px]">&#10003;</span>
          </div>
          <div className="inline-flex items-center gap-2 text-xs">
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: 18, height: 18 }}>
              <NeuralDots size={18} dotCount={4} />
            </div>
            <span className="text-muted-foreground">Querying meetings</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-primary text-[10px]">&#10003;</span>
            <span className="text-muted-foreground">Querying meetings</span>
            <span className="text-primary text-[10px]">&#10003;</span>
          </div>
        </div>
      </section>

      {/* 5. Sidebar logo with dot-text */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">5. Sidebar Logo</h2>
        <div className="flex items-center gap-8">
          {/* Collapsed */}
          <div className="space-y-2 text-center">
            <div className="w-[48px] bg-card border rounded-lg flex items-center justify-center py-4">
              <div className="rounded-full overflow-hidden" style={{ width: 28, height: 28 }}>
                <NeuralDots size={28} dotCount={5} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Collapsed</p>
          </div>

          {/* Expanded — neural dots + stylized text */}
          <div className="space-y-2 text-center">
            <div className="w-56 bg-card border rounded-lg flex items-center gap-3 px-4 py-4">
              <div className="rounded-full overflow-hidden shrink-0" style={{ width: 28, height: 28 }}>
                <NeuralDots size={28} dotCount={5} />
              </div>
              <div className="flex items-center gap-1">
                {"GRANGER".split("").map((letter, i) => (
                  <span
                    key={i}
                    className="text-primary font-mono text-sm font-bold tracking-widest"
                    style={{
                      opacity: 0.5 + i * 0.07,
                      textShadow: "0 0 8px rgba(52,211,153,0.3)",
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Expanded — glowing monospace</p>
          </div>
        </div>
      </section>

      {/* 6. Welcome / empty state */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">6. Welcome / Empty State</h2>
        <div className="flex flex-col items-center py-8">
          <div className="rounded-full overflow-hidden ring-2 ring-primary/20 mb-4" style={{ width: 96, height: 96 }}>
            <NeuralDots size={96} dotCount={14} />
          </div>
          <p className="text-sm font-medium">Ask anything about your team&apos;s knowledge</p>
          <p className="text-xs text-muted-foreground mt-1">Granger searches your documents, meetings, and notes.</p>
        </div>
      </section>

      {/* 7. Background with grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">7. Hero Background with Grid</h2>
        <div className="relative h-64 rounded-xl overflow-hidden border">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(rgba(52,211,153,1) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          {/* Entropy canvas in top-right fading to bottom-left */}
          <div className="absolute -top-20 -right-20 w-[500px] h-[500px] opacity-15" style={{
            maskImage: "linear-gradient(135deg, white 30%, transparent 70%)",
            WebkitMaskImage: "linear-gradient(135deg, white 30%, transparent 70%)",
          }}>
            <Entropy size={500} />
          </div>
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-full overflow-hidden" style={{ width: 32, height: 32 }}>
                <NeuralDots size={32} dotCount={6} />
              </div>
              <span className="font-serif text-3xl font-bold text-primary">Granger</span>
            </div>
            <p className="text-sm text-muted-foreground">Your AI Chief of Staff</p>
          </div>
        </div>
      </section>
    </div>
  );
}
