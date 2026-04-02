"use client";

import { NeuralDots } from "@/components/ui/neural-dots";
import { Entropy } from "@/components/ui/entropy";
import { Loader2 } from "lucide-react";

export default function EntropyShowcasePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-16">
      <div>
        <h1 className="text-2xl font-serif font-bold mb-2">Animation Showcase</h1>
        <p className="text-muted-foreground text-sm">NeuralDots (SVG, lightweight) for UI elements. Entropy (canvas) for backgrounds only.</p>
      </div>

      {/* 1. AI Avatar sizes */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">1. AI Avatar — NeuralDots</h2>
        <p className="text-sm text-muted-foreground">Lightweight SVG animation for chat avatars. Zero CPU overhead.</p>
        <div className="flex items-end gap-6">
          {[24, 32, 40, 48, 64].map((s) => (
            <div key={s} className="text-center space-y-2">
              <div className="rounded-full overflow-hidden ring-1 ring-primary/20 mx-auto" style={{ width: s, height: s }}>
                <NeuralDots size={s} dotCount={s < 32 ? 4 : 6} />
              </div>
              <p className="text-[10px] text-muted-foreground">{s}px</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Chat message mockup */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">2. In Chat Messages</h2>
        <div className="max-w-lg space-y-3">
          {/* AI message */}
          <div className="flex items-start gap-3">
            <div className="rounded-full overflow-hidden ring-1 ring-primary/20 shrink-0" style={{ width: 36, height: 36 }}>
              <NeuralDots size={36} />
            </div>
            <div className="text-sm">Here are your team metrics for this week. Everything looks on track.</div>
          </div>
          {/* User message */}
          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">A</div>
            <div className="bg-secondary rounded-lg px-3 py-2 text-sm">Show me the breakdown by team</div>
          </div>
        </div>
      </section>

      {/* 3. Loading states */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">3. Loading / Thinking States</h2>
        <div className="flex items-start gap-8">
          <div className="space-y-2 text-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Minimal (current)</p>
          </div>
          <div className="space-y-2 text-center">
            <div className="flex items-center gap-2">
              <div className="rounded-full overflow-hidden" style={{ width: 20, height: 20 }}>
                <NeuralDots size={20} dotCount={4} />
              </div>
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
            <p className="text-[10px] text-primary">With neural dots</p>
          </div>
          <div className="space-y-2 text-center">
            <div className="flex items-center gap-3">
              <div className="rounded-full overflow-hidden ring-1 ring-primary/10" style={{ width: 32, height: 32 }}>
                <NeuralDots size={32} />
              </div>
              <div>
                <p className="text-sm">Researching your question</p>
                <p className="text-[10px] text-muted-foreground">Searching knowledge base…</p>
              </div>
            </div>
            <p className="text-[10px] text-primary">Detailed loading</p>
          </div>
        </div>
      </section>

      {/* 4. Tool call indicator */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">4. Tool Call Indicators</h2>
        <div className="space-y-1.5 max-w-md">
          <div className="inline-flex items-center gap-1.5 text-xs">
            <div className="rounded-full overflow-hidden" style={{ width: 14, height: 14 }}>
              <NeuralDots size={14} dotCount={3} />
            </div>
            <span className="text-muted-foreground">Searching knowledge base</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-primary text-[10px]">&#10003;</span>
            <span className="text-muted-foreground">Checking Linear &#10003;</span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs">
            <div className="rounded-full overflow-hidden" style={{ width: 14, height: 14 }}>
              <NeuralDots size={14} dotCount={3} />
            </div>
            <span className="text-muted-foreground">Querying meetings</span>
          </div>
        </div>
      </section>

      {/* 5. Sidebar logo */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">5. Sidebar Logo</h2>
        <div className="flex items-center gap-6">
          <div className="w-[48px] bg-card border-r flex items-center justify-center py-4">
            <div className="rounded-full overflow-hidden" style={{ width: 24, height: 24 }}>
              <NeuralDots size={24} dotCount={4} />
            </div>
          </div>
          <div className="w-56 bg-card border-r flex items-center gap-2 px-4 py-4">
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: 24, height: 24 }}>
              <NeuralDots size={24} dotCount={4} />
            </div>
            <span className="font-serif text-lg font-bold text-primary">Granger</span>
          </div>
        </div>
      </section>

      {/* 6. Empty state / welcome */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">6. Welcome / Empty State</h2>
        <div className="flex flex-col items-center py-8">
          <div className="rounded-full overflow-hidden ring-2 ring-primary/20 mb-4" style={{ width: 80, height: 80 }}>
            <NeuralDots size={80} dotCount={8} />
          </div>
          <p className="text-sm font-medium">Ask anything about your team&apos;s knowledge</p>
          <p className="text-xs text-muted-foreground mt-1">Granger searches your documents, meetings, and notes.</p>
        </div>
      </section>

      {/* 7. Large background — Entropy canvas (use sparingly) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">7. Background (Entropy Canvas — Large Only)</h2>
        <p className="text-sm text-muted-foreground">Heavy canvas animation — only use for hero/splash, never for small elements.</p>
        <div className="relative h-48 rounded-xl overflow-hidden border">
          <Entropy size={800} className="absolute inset-0 opacity-20" />
          <div className="relative z-10 flex flex-col items-center justify-center h-full">
            <span className="font-serif text-3xl font-bold text-primary">Granger</span>
            <p className="text-sm text-muted-foreground mt-1">Your AI Chief of Staff</p>
          </div>
        </div>
      </section>
    </div>
  );
}
