"use client";

import { Entropy } from "@/components/ui/entropy";
import { Bot, User, Loader2, Search, Sparkles, Zap, Brain, MessageSquare } from "lucide-react";

export default function EntropyShowcasePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-16">
      <div>
        <h1 className="text-2xl font-serif font-bold mb-2">Entropy Animation Showcase</h1>
        <p className="text-muted-foreground text-sm">Different ways to use the particle/synapse animation across Granger.</p>
      </div>

      {/* 1. AI Avatar — Chat Messages */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">1. AI Avatar (Chat Messages)</h2>
        <p className="text-sm text-muted-foreground">Replaces the static bot icon next to AI responses. Particles animate inside a circle.</p>
        <div className="flex items-start gap-4">
          {/* Small — inline with messages */}
          <div className="space-y-2 text-center">
            <div className="relative h-8 w-8 rounded-full overflow-hidden ring-1 ring-primary/20">
              <Entropy size={32} className="absolute inset-0" />
            </div>
            <p className="text-[10px] text-muted-foreground">32px</p>
          </div>

          <div className="space-y-2 text-center">
            <div className="relative h-10 w-10 rounded-full overflow-hidden ring-1 ring-primary/20">
              <Entropy size={40} className="absolute inset-0" />
            </div>
            <p className="text-[10px] text-muted-foreground">40px</p>
          </div>

          <div className="space-y-2 text-center">
            <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-primary/30">
              <Entropy size={48} className="absolute inset-0" />
            </div>
            <p className="text-[10px] text-muted-foreground">48px (recommended)</p>
          </div>

          <div className="space-y-2 text-center">
            <div className="relative h-16 w-16 rounded-full overflow-hidden ring-2 ring-primary/30">
              <Entropy size={64} className="absolute inset-0" />
            </div>
            <p className="text-[10px] text-muted-foreground">64px</p>
          </div>
        </div>
      </section>

      {/* 2. User Avatar — With Profile Image */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">2. User Avatar (Profile Image + Fallback)</h2>
        <p className="text-sm text-muted-foreground">Real profile image from Google OAuth, or mint entropy fallback if no image.</p>
        <div className="flex items-start gap-6">
          {/* With image */}
          <div className="space-y-2 text-center">
            <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-primary/30">
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                A
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">With initial</p>
          </div>

          {/* Entropy fallback (mint tinted) */}
          <div className="space-y-2 text-center">
            <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-primary/30" style={{ filter: "hue-rotate(140deg) saturate(1.5)" }}>
              <Entropy size={48} className="absolute inset-0" />
            </div>
            <p className="text-[10px] text-muted-foreground">Mint entropy fallback</p>
          </div>

          {/* Side by side in chat */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="relative h-8 w-8 rounded-full overflow-hidden ring-1 ring-primary/20 shrink-0">
                <Entropy size={32} className="absolute inset-0" />
              </div>
              <div className="bg-card border rounded-lg px-3 py-2 text-sm">
                AI message with entropy avatar
              </div>
            </div>
            <div className="flex items-start gap-3 flex-row-reverse">
              <div className="relative h-8 w-8 rounded-full overflow-hidden ring-1 ring-primary/20 shrink-0 bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                A
              </div>
              <div className="bg-secondary rounded-lg px-3 py-2 text-sm">
                User message with initial avatar
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Loading / Researching State */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">3. Loading / Researching State</h2>
        <p className="text-sm text-muted-foreground">Replaces the "Researching..." spinner with an animated entropy orb.</p>
        <div className="flex items-start gap-8">
          {/* Current boring loading */}
          <div className="space-y-2 text-center">
            <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Researching…</span>
            </div>
            <p className="text-[10px] text-red-400">Current (boring)</p>
          </div>

          {/* New entropy loading */}
          <div className="space-y-2 text-center">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8 rounded-full overflow-hidden">
                <Entropy size={32} className="absolute inset-0" />
              </div>
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
            <p className="text-[10px] text-primary">New (entropy orb)</p>
          </div>

          {/* Larger orb loading */}
          <div className="space-y-2 text-center">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-full overflow-hidden ring-1 ring-primary/10">
                <Entropy size={40} className="absolute inset-0" />
              </div>
              <div>
                <p className="text-sm text-foreground">Researching your question</p>
                <p className="text-[10px] text-muted-foreground">Searching knowledge base, checking Linear…</p>
              </div>
            </div>
            <p className="text-[10px] text-primary">Detailed loading</p>
          </div>
        </div>
      </section>

      {/* 4. Tool Call Indicator */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">4. Tool Call Indicator</h2>
        <p className="text-sm text-muted-foreground">Small entropy pulse next to tool names while executing.</p>
        <div className="space-y-2 max-w-md">
          {/* Running tool */}
          <div className="flex items-center gap-2 text-xs">
            <div className="relative h-4 w-4 rounded-full overflow-hidden">
              <Entropy size={16} className="absolute inset-0" />
            </div>
            <span className="text-muted-foreground">Searching knowledge base</span>
          </div>

          {/* Completed tool */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-primary">✓</span>
            <span className="text-muted-foreground">Checking Linear</span>
            <span className="text-primary">✓</span>
          </div>

          {/* Running tool 2 */}
          <div className="flex items-center gap-2 text-xs">
            <div className="relative h-4 w-4 rounded-full overflow-hidden">
              <Entropy size={16} className="absolute inset-0" />
            </div>
            <span className="text-muted-foreground">Querying meetings</span>
          </div>
        </div>
      </section>

      {/* 5. Hero / Welcome */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">5. Hero / Welcome Screen</h2>
        <p className="text-sm text-muted-foreground">Large entropy as the centerpiece of the welcome/empty chat state.</p>
        <div className="flex flex-col items-center py-8">
          <div className="relative h-24 w-24 rounded-full overflow-hidden ring-2 ring-primary/20 mb-4">
            <Entropy size={96} className="absolute inset-0" />
          </div>
          <p className="text-sm font-medium">Ask anything about your team&apos;s knowledge</p>
          <p className="text-xs text-muted-foreground mt-1">Granger searches your documents, meetings, and notes.</p>
        </div>
      </section>

      {/* 6. Sidebar Logo */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">6. Sidebar Logo</h2>
        <p className="text-sm text-muted-foreground">Replace the "G" text with a tiny entropy animation in the collapsed sidebar.</p>
        <div className="flex items-center gap-6">
          <div className="space-y-2 text-center">
            <div className="w-[48px] bg-card border-r flex items-center justify-center py-4">
              <div className="relative h-6 w-6 rounded-full overflow-hidden">
                <Entropy size={24} className="absolute inset-0" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Collapsed sidebar</p>
          </div>

          <div className="space-y-2 text-center">
            <div className="w-56 bg-card border-r flex items-center gap-2 px-4 py-4">
              <div className="relative h-6 w-6 rounded-full overflow-hidden shrink-0">
                <Entropy size={24} className="absolute inset-0" />
              </div>
              <span className="font-serif text-lg font-bold text-primary">Granger</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Expanded sidebar</p>
          </div>
        </div>
      </section>

      {/* 7. Full Size Preview */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">7. Full Canvas (Background / Splash)</h2>
        <p className="text-sm text-muted-foreground">Large entropy as a background element or splash screen.</p>
        <div className="relative h-64 rounded-xl overflow-hidden border">
          <Entropy size={600} className="absolute inset-0 opacity-30" />
          <div className="relative z-10 flex flex-col items-center justify-center h-full">
            <span className="font-serif text-3xl font-bold text-primary">Granger</span>
            <p className="text-sm text-muted-foreground mt-1">Your AI Chief of Staff</p>
          </div>
        </div>
      </section>
    </div>
  );
}
