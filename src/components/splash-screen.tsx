"use client";

import { useState, useEffect } from "react";
import { NeuralMorph } from "@/components/ui/neural-morph";
import { cn } from "@/lib/utils";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"splash" | "fading" | "done">("splash");

  useEffect(() => {
    // Show splash for 1.8s, then fade out over 0.6s
    const showTimer = setTimeout(() => setPhase("fading"), 1800);
    const doneTimer = setTimeout(() => setPhase("done"), 2400);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "done") return <>{children}</>;

  return (
    <>
      {/* App content renders behind splash (starts loading immediately) */}
      <div className={cn(phase === "fading" ? "opacity-100" : "opacity-0", "transition-opacity duration-500")}>
        {children}
      </div>

      {/* Splash overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] transition-opacity duration-600",
          phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* Animated dots */}
        <div className="mb-6">
          <NeuralMorph size={80} dotCount={20} formation="bloom" />
        </div>

        {/* Logo text */}
        <h1
          className="font-display text-3xl font-bold tracking-tight text-white"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Granger
        </h1>
        <p className="mt-1.5 text-sm text-white/40">Your AI Chief of Staff</p>

        {/* Subtle mint glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 rounded-full bg-[#34d399]/5 blur-3xl" />
        </div>
      </div>
    </>
  );
}
