"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GradientWave } from "@/components/ui/gradient-wave";

interface WaveSidebarProps {
  /** Brand color — used to derive wave palette */
  brandColor: string;
  /** Whether dark mode is active */
  isDark: boolean;
  /** 0–1 scroll progress (0 = top/hero, 1 = scrolled past hero) */
  scrollProgress: number;
}

/**
 * Fixed left + right wave gradient side bars.
 * Uses the GradientWave WebGL component rotated 90° and heavily blurred
 * so only organic color motion is visible. Fades toward center via CSS mask.
 * Width and opacity animate based on scrollProgress.
 */
export function WaveSidebar({ brandColor, isDark, scrollProgress }: WaveSidebarProps) {
  // Derive wave palette from brand color
  const colors = isDark
    ? [brandColor, "#0a0a12", brandColor, "#0a0a12", brandColor]
    : ["#0CE4F2", "#e0f7fa", "#06B6D4", "#f0fdfa", "#0CE4F2"];

  // Interpolate width: 320px → 60px
  const width = Math.round(320 - scrollProgress * 260);
  // Interpolate opacity: 0.55 → 0.12
  const opacity = 0.55 - scrollProgress * 0.43;

  const commonStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    height: "100vh",
    width: `${width}px`,
    zIndex: 1,
    pointerEvents: "none",
    opacity,
    transition: "width 0.3s ease-out, opacity 0.3s ease-out",
    overflow: "hidden",
  };

  // Heavy blur so individual wave lines are invisible — only organic motion shows
  const canvasWrapperStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    filter: "blur(45px)",
    // Rotate the wave 90° so it flows vertically
    transform: "rotate(90deg) scale(2.5)",
    transformOrigin: "center center",
  };

  return (
    <>
      {/* Left wave bar */}
      <div
        style={{
          ...commonStyle,
          left: 0,
          // Mask: gradual fade from opaque at edge to transparent toward center
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 70%, transparent 100%)",
          maskImage: "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      >
        <div style={canvasWrapperStyle}>
          <GradientWave
            colors={colors}
            isPlaying={true}
            noiseSpeed={0.000008}
            noiseFrequency={[0.00012, 0.00025]}
            darkenTop={false}
            shadowPower={3}
            deform={{
              incline: 0.3,
              noiseAmp: 200,
              noiseFlow: 4,
              noiseSpeed: 8,
              noiseSeed: 3,
            }}
          />
        </div>
      </div>

      {/* Right wave bar */}
      <div
        style={{
          ...commonStyle,
          right: 0,
          // Mask: gradual fade from opaque at edge to transparent toward center
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 70%, transparent 100%)",
          maskImage: "linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 70%, transparent 100%)",
        }}
        aria-hidden="true"
      >
        <div style={canvasWrapperStyle}>
          <GradientWave
            colors={colors}
            isPlaying={true}
            noiseSpeed={0.000010}
            noiseFrequency={[0.00015, 0.00030]}
            darkenTop={false}
            shadowPower={3}
            deform={{
              incline: -0.3,
              noiseAmp: 220,
              noiseFlow: 5,
              noiseSpeed: 9,
              noiseSeed: 17,
            }}
          />
        </div>
      </div>
    </>
  );
}
