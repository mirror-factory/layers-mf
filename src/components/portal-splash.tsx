"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface PortalSplashConfig {
  /** Whether the content behind the splash is loaded and ready */
  loaded: boolean;
  /** Client logo URL — falls back to /bluewave-logo.svg */
  logoUrl?: string;
  /** Client/brand name shown below logo */
  clientName?: string;
  /** Subtitle text — defaults to contextual description */
  subtitle?: string;
  /** Primary brand color for accents — defaults to #0DE4F2 */
  brandColor?: string;
  /** Background color — defaults to light blue */
  backgroundColor?: string;
  /** Minimum splash duration in ms — defaults to 1800 */
  minDuration?: number;
  /** Fade duration in ms — defaults to 600 */
  fadeDuration?: number;
  /** Children to render behind splash */
  children: React.ReactNode;
}

export function PortalSplash({
  loaded,
  logoUrl,
  clientName,
  subtitle,
  brandColor = "#0DE4F2",
  backgroundColor = "#f4fbff",
  minDuration = 2200,
  fadeDuration = 800,
  children,
}: PortalSplashConfig) {
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [phase, setPhase] = useState<"splash" | "fading" | "done">("splash");

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), minDuration);
    return () => clearTimeout(timer);
  }, [minDuration]);

  useEffect(() => {
    if (loaded && minTimePassed && phase === "splash") {
      setPhase("fading");
      const timer = setTimeout(() => setPhase("done"), fadeDuration);
      return () => clearTimeout(timer);
    }
  }, [loaded, minTimePassed, phase, fadeDuration]);

  if (phase === "done") return <>{children}</>;

  return (
    <>
      <div
        className={cn(
          "transition-opacity",
          phase === "fading" ? "opacity-100" : "opacity-0"
        )}
        style={{
          transitionDuration: `${fadeDuration}ms`,
          willChange: phase === "fading" ? "opacity" : undefined,
          contain: "layout",
        }}
      >
        {children}
      </div>

      {/* Splash overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-center px-8 transition-opacity",
          phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        style={{ backgroundColor, transitionDuration: `${fadeDuration}ms` }}
      >
        {/* Animated loading dots */}
        <div className="mb-8 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full animate-pulse"
              style={{
                backgroundColor: brandColor,
                animationDelay: `${i * 250}ms`,
                opacity: 0.5 + i * 0.2,
              }}
            />
          ))}
        </div>

        {/* Client logo — large and prominent */}
        <img
          src={logoUrl || "/bluewave-logo.svg"}
          alt={clientName || "Portal"}
          className="h-16 md:h-20 w-auto mb-6"
        />

        {/* "Prepared by" line */}
        <p className="text-sm text-slate-400 mb-1">
          Proposal prepared by
        </p>
        <p className="text-base font-semibold text-slate-700 mb-6">
          Mirror Factory
        </p>

        {/* Value proposition — non-technical */}
        <p className="text-center text-sm text-slate-500 max-w-sm leading-relaxed mb-2">
          {subtitle || "Browse your complete proposal library, ask questions, and get instant clarity on every detail — just speak or type."}
        </p>

        {/* Glow effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="h-72 w-72 rounded-full blur-3xl opacity-30"
            style={{ backgroundColor: brandColor }}
          />
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 text-center">
          <p className="text-[11px] text-slate-400">
            Visit{" "}
            <a
              href="https://mirrorfactory.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-slate-600 transition-colors"
              style={{ color: brandColor }}
            >
              mirrorfactory.com
            </a>
            {" "}to learn more
          </p>
        </div>
      </div>
    </>
  );
}
