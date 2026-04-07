"use client";

import Link from "next/link";
import { MessageSquare, FileText } from "lucide-react";

interface HomeHeroProps {
  greeting: string;
  displayName: string;
  subtitle: string;
}

export function HomeHero({ greeting, displayName, subtitle }: HomeHeroProps) {
  return (
    <div className="relative rounded-xl border overflow-hidden bg-card" style={{ minHeight: 280 }}>
      {/* Subtle dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(52, 211, 153, 0.05) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 p-6 sm:p-8">
        <p className="text-xs font-medium text-primary/70 tracking-wide uppercase mb-2">
          Granger
        </p>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight">
          <span className="text-primary">{greeting}, {displayName}</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg text-sm">
          {subtitle}
        </p>
        <div className="flex flex-wrap gap-2 mt-5">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Chat with Granger
          </Link>
          <Link
            href="/context"
            className="inline-flex items-center gap-2 rounded-lg border bg-background/80 backdrop-blur px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <FileText className="h-4 w-4" />
            Browse Context
          </Link>
        </div>
      </div>
    </div>
  );
}
