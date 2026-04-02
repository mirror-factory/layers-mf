"use client";

import { NeuralDots } from "@/components/ui/neural-dots";
import { useState } from "react";

const STATES = ["idle", "active"] as const;

export default function EntropyShowcasePage() {
  const [globalActive, setGlobalActive] = useState(false);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-16">
      <div>
        <h1 className="text-2xl font-display font-bold mb-2">NeuralDots State Animations</h1>
        <p className="text-muted-foreground text-sm">Click any animation to toggle active/idle state. Or use the global toggle:</p>
        <button
          onClick={() => setGlobalActive(a => !a)}
          className="mt-3 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-primary/10 text-primary border-primary/30"
        >
          {globalActive ? "● Active (generating)" : "○ Idle (done)"}
        </button>
      </div>

      {/* Idea 1: Speed-based (current) — dots pulse faster/slower */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Idea 1: Speed-Based (Current Implementation)</h2>
        <p className="text-xs text-muted-foreground">Active = dots pulse fast, connections fire rapidly. Idle = slow float.</p>
        <div className="flex items-center gap-8">
          {[
            { dots: 8, label: "Older msg (8 dots)" },
            { dots: 12, label: "Latest msg (12 dots)" },
            { dots: 12, label: "Generating (12 dots, active)", forceActive: true },
            { dots: 16, label: "Dense (16 dots, active)", forceActive: true },
          ].map(({ dots, label, forceActive }, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="rounded-full overflow-hidden mx-auto" style={{ width: 64, height: 64 }}>
                <NeuralDots size={64} dotCount={dots} active={forceActive ?? globalActive} />
              </div>
              <p className="text-[10px] text-muted-foreground max-w-[100px]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Idea 2: Orbit Ring — dots form a circle and rotate */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Idea 2: Orbit Ring</h2>
        <p className="text-xs text-muted-foreground">Active = dots align into a spinning ring. Idle = dispersed.</p>
        <div className="flex items-center gap-8">
          {[false, true, true, true].map((active, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="rounded-full overflow-hidden mx-auto" style={{ width: 64, height: 64 }}>
                <svg width={64} height={64} viewBox="0 0 64 64">
                  <defs>
                    <radialGradient id={`orbit-bg-${i}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={active ? "0.06" : "0.02"} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx={32} cy={32} r={30} fill={`url(#orbit-bg-${i})`} />
                  {Array.from({ length: [6, 8, 10, 14][i] }).map((_, j, arr) => {
                    const angle = (j / arr.length) * Math.PI * 2;
                    const radius = active ? 20 : 10 + Math.random() * 15;
                    const x = 32 + Math.cos(angle) * radius;
                    const y = 32 + Math.sin(angle) * radius;
                    const dur = active ? `${3 + i * 0.5}s` : `${6 + j}s`;
                    return (
                      <g key={j}>
                        <circle cx={x} cy={y} r={1.5} fill="#34d399" opacity={0.4}>
                          <animate attributeName="opacity" values={active ? "0.3;0.8;0.3" : "0.15;0.35;0.15"} dur={dur} repeatCount="indefinite" />
                        </circle>
                        {active && (
                          <animateTransform attributeName="transform" type="rotate"
                            from={`0 32 32`} to={`360 32 32`}
                            dur={`${4 + i}s`} repeatCount="indefinite" />
                        )}
                      </g>
                    );
                  })}
                  <circle cx={32} cy={32} r={2} fill="#34d399" opacity={active ? 0.7 : 0.3}>
                    <animate attributeName="opacity" values={active ? "0.5;0.9;0.5" : "0.2;0.4;0.2"} dur="2s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
              <p className="text-[10px] text-muted-foreground">{active ? `Ring (${[6, 8, 10, 14][i]} dots)` : "Dispersed"}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Idea 3: Breathing — dots expand outward and contract */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Idea 3: Breathing</h2>
        <p className="text-xs text-muted-foreground">Active = dots expand and contract rhythmically like breathing. Idle = still.</p>
        <div className="flex items-center gap-8">
          {[false, true, true, true].map((active, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="rounded-full overflow-hidden mx-auto" style={{ width: 64, height: 64 }}>
                <svg width={64} height={64} viewBox="0 0 64 64">
                  {Array.from({ length: [8, 10, 12, 16][i] }).map((_, j, arr) => {
                    const angle = (j / arr.length) * Math.PI * 2 + (j * 0.3);
                    const baseR = 12 + (j % 3) * 4;
                    const x = 32 + Math.cos(angle) * baseR;
                    const y = 32 + Math.sin(angle) * baseR;
                    const breathSpeed = [4, 3, 2.5, 2][i];
                    return (
                      <circle key={j} cx={active ? undefined : x} cy={active ? undefined : y} r={1.2} fill="#34d399" opacity={0.4}>
                        {active && (
                          <>
                            <animate attributeName="cx" values={`${32};${x};${32 + Math.cos(angle) * (baseR + 8)};${x};${32}`} dur={`${breathSpeed}s`} begin={`${j * 0.1}s`} repeatCount="indefinite" />
                            <animate attributeName="cy" values={`${32};${y};${32 + Math.sin(angle) * (baseR + 8)};${y};${32}`} dur={`${breathSpeed}s`} begin={`${j * 0.1}s`} repeatCount="indefinite" />
                          </>
                        )}
                        <animate attributeName="opacity" values={active ? "0.2;0.7;0.2" : "0.15;0.3;0.15"} dur={`${active ? breathSpeed : 5}s`} repeatCount="indefinite" />
                      </circle>
                    );
                  })}
                  <circle cx={32} cy={32} r={2} fill="#34d399" opacity={0.5}>
                    <animate attributeName="r" values={active ? "1.5;3;1.5" : "1.5;2;1.5"} dur={active ? `${[4, 3, 2.5, 2][i]}s` : "4s"} repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
              <p className="text-[10px] text-muted-foreground">{active ? `Breathing (${[4, 3, 2.5, 2][i]}s)` : "Still"}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Idea 4: Constellation — dots form shapes (triangle, square, star) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Idea 4: Constellation Shapes</h2>
        <p className="text-xs text-muted-foreground">Active = dots align into geometric shapes. Idle = random cloud.</p>
        <div className="flex items-center gap-8">
          {["cloud", "triangle", "square", "hexagon"].map((shape, i) => {
            const active = shape !== "cloud";
            const sides = shape === "triangle" ? 3 : shape === "square" ? 4 : shape === "hexagon" ? 6 : 0;
            const dots = sides > 0 ? sides * 2 : 10;
            return (
              <div key={shape} className="text-center space-y-2">
                <div className="rounded-full overflow-hidden mx-auto" style={{ width: 64, height: 64 }}>
                  <svg width={64} height={64} viewBox="0 0 64 64">
                    {Array.from({ length: dots }).map((_, j) => {
                      let x: number, y: number;
                      if (sides > 0) {
                        const sideIdx = Math.floor(j / 2);
                        const t = (j % 2) * 0.5;
                        const a1 = (sideIdx / sides) * Math.PI * 2 - Math.PI / 2;
                        const a2 = ((sideIdx + 1) / sides) * Math.PI * 2 - Math.PI / 2;
                        x = 32 + (Math.cos(a1) * 18 * (1 - t) + Math.cos(a2) * 18 * t);
                        y = 32 + (Math.sin(a1) * 18 * (1 - t) + Math.sin(a2) * 18 * t);
                      } else {
                        const angle = (j / dots) * Math.PI * 2 + j * 0.7;
                        const dist = 8 + (j * 7) % 15;
                        x = 32 + Math.cos(angle) * dist;
                        y = 32 + Math.sin(angle) * dist;
                      }
                      return (
                        <g key={j}>
                          <circle cx={x} cy={y} r={1.3} fill="#34d399" opacity={0.5}>
                            <animate attributeName="opacity" values="0.3;0.7;0.3" dur={`${2 + j * 0.2}s`} repeatCount="indefinite" />
                          </circle>
                          {j > 0 && sides > 0 && (
                            <line x1={x} y1={y}
                              x2={32 + (sides > 0 ? Math.cos((Math.floor((j - 1) / 2) / sides) * Math.PI * 2 - Math.PI / 2) * 18 * (1 - ((j - 1) % 2) * 0.5) + Math.cos(((Math.floor((j - 1) / 2) + 1) / sides) * Math.PI * 2 - Math.PI / 2) * 18 * (((j - 1) % 2) * 0.5) : 0)}
                              y2={32 + (sides > 0 ? Math.sin((Math.floor((j - 1) / 2) / sides) * Math.PI * 2 - Math.PI / 2) * 18 * (1 - ((j - 1) % 2) * 0.5) + Math.sin(((Math.floor((j - 1) / 2) + 1) / sides) * Math.PI * 2 - Math.PI / 2) * 18 * (((j - 1) % 2) * 0.5) : 0)}
                              stroke="#34d399" strokeWidth={0.3} opacity={0.2}>
                              <animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${2 + j * 0.1}s`} repeatCount="indefinite" />
                            </line>
                          )}
                        </g>
                      );
                    })}
                    <circle cx={32} cy={32} r={1.5} fill="#34d399" opacity={0.6} />
                  </svg>
                </div>
                <p className="text-[10px] text-muted-foreground capitalize">{shape}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Size comparison with all 3 states */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">State Comparison — Side by Side</h2>
        <div className="grid grid-cols-3 gap-8 max-w-lg">
          <div className="text-center space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Older Message</p>
            <div className="rounded-full overflow-hidden mx-auto" style={{ width: 48, height: 48 }}>
              <NeuralDots size={48} dotCount={8} active={false} />
            </div>
            <p className="text-[10px] text-muted-foreground">8 dots, slow</p>
          </div>
          <div className="text-center space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Latest Complete</p>
            <div className="rounded-full overflow-hidden mx-auto" style={{ width: 48, height: 48 }}>
              <NeuralDots size={48} dotCount={12} active={false} />
            </div>
            <p className="text-[10px] text-muted-foreground">12 dots, slow</p>
          </div>
          <div className="text-center space-y-2">
            <p className="text-xs font-medium text-primary">Generating</p>
            <div className="rounded-full overflow-hidden mx-auto" style={{ width: 48, height: 48 }}>
              <NeuralDots size={48} dotCount={12} active={true} />
            </div>
            <p className="text-[10px] text-primary">12 dots, fast</p>
          </div>
        </div>
      </section>
    </div>
  );
}
