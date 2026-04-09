"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface PortalSplashConfig {
  /** Whether the content behind the splash is loaded and ready */
  loaded: boolean;
  /** Logo URL — falls back to /bluewave-logo.svg */
  logoUrl?: string;
  /** Client/brand name shown below logo */
  clientName?: string;
  /** Subtitle text — defaults to "Proposal Portal" */
  subtitle?: string;
  /** Primary brand color for accents — defaults to #0DE4F2 */
  brandColor?: string;
  /** Background color — defaults to light blue */
  backgroundColor?: string;
  /** Minimum splash duration in ms — defaults to 1200 */
  minDuration?: number;
  /** Fade duration in ms — defaults to 500 */
  fadeDuration?: number;
  /** Children to render behind splash */
  children: React.ReactNode;
}

export function PortalSplash({
  loaded,
  logoUrl,
  clientName,
  subtitle = "Proposal Portal",
  brandColor = "#0DE4F2",
  backgroundColor = "#f4fbff",
  minDuration = 1200,
  fadeDuration = 500,
  children,
}: PortalSplashConfig) {
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [phase, setPhase] = useState<"splash" | "fading" | "done">("splash");

  // Minimum display time
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), minDuration);
    return () => clearTimeout(timer);
  }, [minDuration]);

  // Start fading when both loaded AND min time passed
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
      {/* Content renders behind splash (starts mounting immediately) */}
      <div
        className={cn(
          "transition-opacity",
          phase === "fading" ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: `${fadeDuration}ms` }}
      >
        {children}
      </div>

      {/* Splash overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity",
          phase === "fading"
            ? "opacity-0 pointer-events-none"
            : "opacity-100"
        )}
        style={{
          backgroundColor,
          transitionDuration: `${fadeDuration}ms`,
        }}
      >
        {/* Animated loading dots */}
        <div className="mb-6 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2.5 w-2.5 rounded-full animate-pulse"
              style={{
                backgroundColor: brandColor,
                animationDelay: `${i * 200}ms`,
                opacity: 0.6 + i * 0.15,
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <img
          src={logoUrl || "/bluewave-logo.svg"}
          alt={clientName || "Portal"}
          className="h-10 w-auto opacity-90"
        />

        {/* Subtitle */}
        <p
          className="mt-2 text-sm font-medium"
          style={{ color: `${brandColor}90` }}
        >
          {subtitle}
        </p>

        {/* Glow effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="h-64 w-64 rounded-full blur-3xl"
            style={{ backgroundColor: `${brandColor}15` }}
          />
        </div>
      </div>
    </>
  );
}
