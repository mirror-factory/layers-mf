"use client";

import { useState, useRef, useEffect, useMemo, CSSProperties } from "react";
import { DitheringShader } from "@/components/ui/dithering-shader";
import { ChevronDown, Sparkles, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Hero Variant 1: Full-screen Wave Dithering (Sphere effect, but full viewport)
// The dithering wave fills the entire screen with blur overlay
// ---------------------------------------------------------------------------
function HeroFullWave() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <section ref={containerRef} className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030308]">
      {/* Full-screen wave dithering — the "sphere" shape spread as a wave */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <DitheringShader
          width={dims.w}
          height={dims.h}
          colorBack="#050510"
          colorFront="#0CE4F2"
          shape="wave"
          type="8x8"
          pxSize={3}
          speed={0.35}
          style={{ width: "100%", height: "100%" }}
          className="opacity-60"
        />
      </div>

      {/* Second layer — simplex for organic depth, screen-blended */}
      <div className="absolute inset-0 z-[1] pointer-events-none mix-blend-screen">
        <DitheringShader
          width={dims.w}
          height={dims.h}
          colorBack="#00000000"
          colorFront="#0891B2"
          shape="simplex"
          type="4x4"
          pxSize={4}
          speed={0.2}
          style={{ width: "100%", height: "100%" }}
          className="opacity-20"
        />
      </div>

      {/* Stronger blur overlay — diffuses the dots into a smooth glow */}
      <div className="absolute inset-0 z-[2] pointer-events-none backdrop-blur-[6px]" />

      {/* Vignette overlay — large clear center, strong edge darkening */}
      <div className="absolute inset-0 z-[3] pointer-events-none" style={{
        background: "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 15%, rgba(3,3,8,0.35) 45%, rgba(3,3,8,0.75) 70%, rgba(3,3,8,0.95) 100%)",
      }} />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 z-[4] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #030308)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-6 max-w-5xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0CE4F2]/30 bg-[#0CE4F2]/8 px-5 py-2 text-[10px] font-medium tracking-[0.2em] uppercase text-[#0CE4F2] backdrop-blur-md"
          style={{ textShadow: "0 0 12px rgba(12,228,242,0.5)" }}>
          <Sparkles className="h-3 w-3" /> Interactive Experience
        </div>

        <h1 className="text-6xl font-extrabold tracking-tight sm:text-7xl lg:text-[9rem]"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #0CE4F2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 40px rgba(12,228,242,0.35)) drop-shadow(0 0 80px rgba(12,228,242,0.15))",
          }}>
          Swell
        </h1>

        <p className="max-w-xl text-base text-white/50 tracking-wide"
          style={{ textShadow: "0 0 20px rgba(12,228,242,0.2)" }}>
          Full-viewport dithered wave — digital particles flowing as an ocean
        </p>

        <ChevronDown className="mt-8 h-6 w-6 animate-bounce text-[#0CE4F2]/60"
          style={{ filter: "drop-shadow(0 0 8px rgba(12,228,242,0.4))" }} />
      </div>

      <style>{`
        @keyframes hero-grad {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hero Variant 2: Warp Dithering Card
// ---------------------------------------------------------------------------
function HeroWarpCard() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050508] px-6">
      <div
        className="relative w-full max-w-6xl overflow-hidden rounded-[48px] border border-white/[0.06] bg-white/[0.015] shadow-2xl min-h-[600px] flex flex-col items-center justify-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Warp dithering background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 mix-blend-screen">
          <DitheringShader
            width={1400}
            height={800}
            colorBack="#000000"
            colorFront="#0CE4F2"
            shape="warp"
            type="4x4"
            pxSize={4}
            speed={isHovered ? 0.8 : 0.3}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 text-center px-6 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0CE4F2]/20 bg-[#0CE4F2]/5 px-5 py-2 text-[10px] font-medium tracking-[0.2em] uppercase text-[#0CE4F2]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0CE4F2] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0CE4F2]" />
            </span>
            Interactive Experience
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
            style={{
              background: "linear-gradient(135deg, #ffffff 20%, #0CE4F2 50%, #ffffff 80%)",
              backgroundSize: "200% 200%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "hero-grad 5s ease-in-out infinite",
            }}>
            Warp Card
          </h1>

          <p className="max-w-xl text-lg text-white/40">
            Hover-reactive warp dithering inside a rounded card
          </p>

          <button className="group inline-flex h-14 items-center justify-center gap-3 rounded-full px-12 text-base font-medium text-white transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ backgroundColor: "#0CE4F2", boxShadow: "0 6px 24px rgba(12,228,242,0.3)" }}>
            Get Started
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hero Variant 3: Blinking Dot Grid (from image-loading)
// Uses the blinking dot grid as a hero background with blue dots + blur overlay
// ---------------------------------------------------------------------------
function DotGrid({ width, height, gridSize = 14, cellGap = 4, color = "#0CE4F2" }: {
  width: number; height: number; gridSize?: number; cellGap?: number; color?: string;
}) {
  const cells = useMemo(() => {
    const cellWithGap = gridSize + cellGap;
    const cols = Math.ceil(width / cellWithGap) + 1;
    const rows = Math.ceil(height / cellWithGap) + 1;
    const result: { x: number; y: number; delay: number; opacity: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          x: c * cellWithGap,
          y: r * cellWithGap,
          delay: Math.random() * 2000,
          opacity: Math.random() * 0.6 + 0.2,
        });
      }
    }
    return result;
  }, [width, height, gridSize, cellGap]);

  return (
    <>
      <style>{`
        @keyframes dot-blink {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.8; }
        }
      `}</style>
      {cells.map((cell, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: cell.x,
            top: cell.y,
            width: gridSize,
            height: gridSize,
            backgroundColor: color,
            opacity: cell.opacity,
            animation: `dot-blink ${1500 + Math.random() * 1500}ms ease-in-out infinite`,
            animationDelay: `${cell.delay}ms`,
          } as CSSProperties}
        />
      ))}
    </>
  );
}

function HeroDotGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1920, h: 900 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <section ref={containerRef} className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030308]">
      {/* Blinking dot grid background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <DotGrid width={dims.w} height={dims.h} gridSize={10} cellGap={8} color="#0CE4F2" />
      </div>

      {/* Blur overlay — makes dots look like they're shining through frosted glass */}
      <div className="absolute inset-0 z-[1] pointer-events-none backdrop-blur-[3px]" />

      {/* Radial glow to enhance center */}
      <div className="absolute inset-0 z-[2] pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(12,228,242,0.06) 0%, transparent 70%)",
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 z-[3] pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(3,3,8,0.7) 70%, rgba(3,3,8,0.95) 100%)",
      }} />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 z-[4] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #030308)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-6 max-w-5xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0CE4F2]/25 bg-[#0CE4F2]/5 px-5 py-2 text-[10px] font-medium tracking-[0.2em] uppercase text-[#0CE4F2] backdrop-blur-sm">
          <Sparkles className="h-3 w-3" /> Dot Grid
        </div>

        <h1 className="text-6xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #0CE4F2 40%, #ffffff 60%, #0CE4F2 100%)",
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "hero-grad 6s ease-in-out infinite",
          }}>
          Swell
        </h1>

        <p className="max-w-xl text-lg text-white/40">
          Blinking dot grid with blur overlay — dots shining through frosted glass
        </p>

        <ChevronDown className="mt-8 h-6 w-6 animate-bounce text-[#0CE4F2]/50" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hero Variant 4: Full Simplex Dithering (organic noise field)
// ---------------------------------------------------------------------------
function HeroSimplexField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <section ref={containerRef} className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030308]">
      {/* Full simplex noise dithering */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <DitheringShader
          width={dims.w}
          height={dims.h}
          colorBack="#050510"
          colorFront="#0CE4F2"
          shape="simplex"
          type="8x8"
          pxSize={3}
          speed={0.3}
          style={{ width: "100%", height: "100%" }}
          className="opacity-55"
        />
      </div>

      {/* Warp overlay for organic motion */}
      <div className="absolute inset-0 z-[1] pointer-events-none mix-blend-screen">
        <DitheringShader
          width={dims.w}
          height={dims.h}
          colorBack="#00000000"
          colorFront="#0891B2"
          shape="warp"
          type="4x4"
          pxSize={5}
          speed={0.2}
          style={{ width: "100%", height: "100%" }}
          className="opacity-20"
        />
      </div>

      {/* Subtle blur */}
      <div className="absolute inset-0 z-[2] pointer-events-none backdrop-blur-[1px]" />

      {/* Vignette */}
      <div className="absolute inset-0 z-[3] pointer-events-none" style={{
        background: "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 20%, rgba(3,3,8,0.55) 65%, rgba(3,3,8,0.92) 100%)",
      }} />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 z-[4] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #030308)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-6 max-w-5xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0CE4F2]/25 bg-[#0CE4F2]/5 px-5 py-2 text-[10px] font-medium tracking-[0.2em] uppercase text-[#0CE4F2] backdrop-blur-sm">
          <Sparkles className="h-3 w-3" /> Simplex Field
        </div>

        <h1 className="text-6xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #0CE4F2 35%, #ffffff 60%, #0CE4F2 100%)",
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "hero-grad 6s ease-in-out infinite",
          }}>
          Swell
        </h1>

        <p className="max-w-xl text-lg text-white/40">
          Dual-layer simplex + warp noise field with subtle blur
        </p>

        <ChevronDown className="mt-8 h-6 w-6 animate-bounce text-[#0CE4F2]/50" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page — All variants with switcher
// ---------------------------------------------------------------------------
export default function HeroLabPage() {
  const [active, setActive] = useState(0);
  const variants = [
    { label: "Full Wave", component: <HeroFullWave /> },
    { label: "Warp Card", component: <HeroWarpCard /> },
    { label: "Dot Grid", component: <HeroDotGrid /> },
    { label: "Simplex Field", component: <HeroSimplexField /> },
  ];

  return (
    <div className="bg-[#030308] min-h-screen">
      {/* Sticky nav to switch between variants */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-1 py-3 backdrop-blur-xl bg-[#030308]/80 border-b border-white/[0.06]">
        {variants.map((v, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              i === active
                ? "bg-[#0CE4F2]/15 text-[#0CE4F2]"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {variants[active].component}
    </div>
  );
}
