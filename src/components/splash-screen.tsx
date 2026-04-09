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
          "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f4fbff] transition-opacity duration-600",
          phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* Animated dots */}
        <div className="mb-6">
          <NeuralMorph size={80} dotCount={20} formation="bloom" color="#0DE4F2" />
        </div>

        {/* BlueWave logo */}
        <img
          src="/bluewave-logo.svg"
          alt="BlueWave"
          className="h-8 w-auto opacity-90"
        />
        <p className="mt-2 text-sm text-sky-700/70">Proposal Portal</p>

        {/* Subtle blue glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-64 w-64 rounded-full bg-[#0DE4F2]/10 blur-3xl" />
        </div>
      </div>
    </>
  );
}
