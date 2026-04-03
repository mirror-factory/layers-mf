"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type Formation =
  // Core states (for chat avatar)
  | "idle" | "active" | "done" | "error"
  // Abstract patterns
  | "scatter" | "ring" | "spiral" | "galaxy" | "orbit" | "helix" | "flow" | "bloom"
  // Geometric
  | "triangle" | "hexagon" | "star" | "infinity" | "grid"
  // Physics
  | "breathe" | "pulse" | "converge" | "disperse" | "vortex" | "wave"
  // Symbolic
  | "heart" | "check" | "cross";

interface Dot {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  opacity: number;
  targetOpacity: number;
}

// Formations that animate continuously
const ANIMATED_FORMATIONS = new Set<Formation>(["active", "orbit", "galaxy", "helix", "flow", "vortex", "wave", "breathe", "pulse", "bloom"]);

function getFormationPositions(formation: Formation, count: number, cx: number, cy: number, r: number, time = 0): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));


  switch (formation) {
    // === CORE STATES ===
    case "idle": {
      // Fibonacci spiral — organic, calm, slowly drifting
      for (let i = 0; i < count; i++) {
        const angle = i * goldenAngle + time * 0.05;
        const dist = r * (0.15 + (i / count) * 0.75);
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "active": {
      // Fast orbiting layers — energized, busy
      for (let i = 0; i < count; i++) {
        const layer = i % 3;
        const layerR = r * (0.25 + layer * 0.25);
        const speed = (3 - layer) * 0.8;
        const offset = (i / count) * Math.PI * 2;
        const angle = offset + time * speed + layer * Math.PI * 0.3;
        positions.push({ x: cx + Math.cos(angle) * layerR, y: cy + Math.sin(angle) * layerR });
      }
      break;
    }
    case "done": {
      // Settled, evenly spaced circle — calm confidence
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        positions.push({ x: cx + Math.cos(angle) * r * 0.6, y: cy + Math.sin(angle) * r * 0.6 });
      }
      break;
    }
    case "error": {
      // Scattered outward, trembling
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const jitter = Math.sin(time * 8 + i * 3) * 3;
        positions.push({ x: cx + Math.cos(angle) * r * 0.85 + jitter, y: cy + Math.sin(angle) * r * 0.85 + jitter });
      }
      break;
    }
    // === ABSTRACT PATTERNS ===
    case "scatter": {
      for (let i = 0; i < count; i++) {
        const angle = i * goldenAngle;
        const dist = r * (0.15 + (i / count) * 0.78);
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "ring": {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        positions.push({ x: cx + Math.cos(angle) * r * 0.7, y: cy + Math.sin(angle) * r * 0.7 });
      }
      break;
    }
    case "spiral": {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 5;
        const dist = r * (0.08 + t * 0.82);
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "galaxy": {
      // Two-arm spiral galaxy, rotating
      for (let i = 0; i < count; i++) {
        const arm = i % 2;
        const t = Math.floor(i / 2) / Math.ceil(count / 2);
        const angle = t * Math.PI * 2.5 + arm * Math.PI + time * 0.3;
        const dist = r * (0.08 + t * 0.8);
        const wobble = Math.sin(t * 8 + time) * r * 0.04;
        positions.push({
          x: cx + Math.cos(angle) * dist + wobble,
          y: cy + Math.sin(angle) * dist * 0.65 + wobble,
        });
      }
      break;
    }
    case "orbit": {
      // Concentric rings rotating opposite directions
      const rings = [0.28, 0.52, 0.76];
      const speeds = [0.7, -0.5, 0.3];
      for (let i = 0; i < count; i++) {
        const ri = i % 3;
        const pos = Math.floor(i / 3) / Math.ceil(count / 3);
        const angle = pos * Math.PI * 2 + time * speeds[ri];
        positions.push({ x: cx + Math.cos(angle) * r * rings[ri], y: cy + Math.sin(angle) * r * rings[ri] });
      }
      break;
    }
    case "helix": {
      // Double helix rotating
      for (let i = 0; i < count; i++) {
        const strand = i % 2;
        const t = Math.floor(i / 2) / Math.ceil(count / 2);
        const angle = t * Math.PI * 3 + time * 0.8 + strand * Math.PI;
        const x = cx + Math.cos(angle) * r * 0.4;
        const y = cy - r * 0.8 + t * r * 1.6;
        positions.push({ x, y });
      }
      break;
    }
    case "flow": {
      // Smooth flowing stream — dots travel along a curved path
      for (let i = 0; i < count; i++) {
        const t = ((i / count) + time * 0.15) % 1;
        const x = cx - r * 0.8 + t * r * 1.6;
        const y = cy + Math.sin(t * Math.PI * 2.5 + time * 0.5) * r * 0.35;
        positions.push({ x, y });
      }
      break;
    }
    case "bloom": {
      // Dots expand outward like a flower blooming, then retract
      const breathPhase = (Math.sin(time * 0.8) + 1) / 2;
      for (let i = 0; i < count; i++) {
        const angle = i * goldenAngle;
        const baseDist = r * (0.15 + (i / count) * 0.4);
        const expandDist = baseDist + breathPhase * r * 0.4;
        positions.push({ x: cx + Math.cos(angle) * expandDist, y: cy + Math.sin(angle) * expandDist });
      }
      break;
    }
    // === GEOMETRIC ===
    case "triangle": {
      for (let i = 0; i < count; i++) {
        const side = i % 3;
        const t = Math.floor(i / 3) / Math.ceil(count / 3);
        const a1 = (side / 3) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((side + 1) / 3) * Math.PI * 2 - Math.PI / 2;
        positions.push({
          x: cx + (Math.cos(a1) * (1 - t) + Math.cos(a2) * t) * r * 0.7,
          y: cy + (Math.sin(a1) * (1 - t) + Math.sin(a2) * t) * r * 0.7,
        });
      }
      break;
    }
    case "hexagon": {
      for (let i = 0; i < count; i++) {
        const side = i % 6;
        const t = Math.floor(i / 6) / Math.ceil(count / 6);
        const a1 = (side / 6) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((side + 1) / 6) * Math.PI * 2 - Math.PI / 2;
        positions.push({
          x: cx + (Math.cos(a1) * (1 - t) + Math.cos(a2) * t) * r * 0.7,
          y: cy + (Math.sin(a1) * (1 - t) + Math.sin(a2) * t) * r * 0.7,
        });
      }
      break;
    }
    case "star": {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const dist = i % 2 === 0 ? r * 0.75 : r * 0.35;
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "infinity": {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const s = r * 0.45;
        const denom = 1 + Math.sin(t) * Math.sin(t);
        positions.push({
          x: cx + s * Math.cos(t) / denom,
          y: cy + s * Math.sin(t) * Math.cos(t) / denom,
        });
      }
      break;
    }
    case "grid": {
      const cols = Math.ceil(Math.sqrt(count));
      const spacing = (r * 1.3) / cols;
      const off = (cols - 1) * spacing / 2;
      for (let i = 0; i < count; i++) {
        positions.push({ x: cx - off + (i % cols) * spacing, y: cy - off + Math.floor(i / cols) * spacing });
      }
      break;
    }
    // === PHYSICS ===
    case "breathe": {
      const phase = (Math.sin(time * 0.6) + 1) / 2;
      for (let i = 0; i < count; i++) {
        const angle = i * goldenAngle;
        const dist = r * (0.2 + (i / count) * 0.3 + phase * 0.4);
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "pulse": {
      // All dots at center then burst outward rhythmically
      const pulsePhase = Math.abs(Math.sin(time * 1.5));
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = r * 0.05 + pulsePhase * r * 0.7;
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "converge": {
      // All dots collapse to center
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        positions.push({ x: cx + Math.cos(angle) * r * 0.06, y: cy + Math.sin(angle) * r * 0.06 });
      }
      break;
    }
    case "disperse": {
      // All dots fly to edges
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + i * 0.3;
        positions.push({ x: cx + Math.cos(angle) * r * 0.92, y: cy + Math.sin(angle) * r * 0.92 });
      }
      break;
    }
    case "vortex": {
      // Spinning inward spiral
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 4 + time * 2;
        const dist = r * (0.8 - t * 0.7);
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "wave": {
      // Sine wave flowing
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        positions.push({
          x: cx - r * 0.8 + t * r * 1.6,
          y: cy + Math.sin(t * Math.PI * 2.5 + time * 2) * r * 0.35,
        });
      }
      break;
    }
    // === SYMBOLIC ===
    case "heart": {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const s = r * 0.04;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        positions.push({ x: cx + hx * s, y: cy + hy * s + r * 0.1 });
      }
      break;
    }
    case "check": {
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        if (t < 0.35) {
          const lt = t / 0.35;
          positions.push({ x: cx - r * 0.45 + lt * r * 0.35, y: cy + lt * r * 0.35 });
        } else {
          const lt = (t - 0.35) / 0.65;
          positions.push({ x: cx - r * 0.1 + lt * r * 0.6, y: cy + r * 0.35 - lt * r * 0.75 });
        }
      }
      break;
    }
    case "cross": {
      const half = Math.floor(count / 2);
      for (let i = 0; i < half; i++) {
        const t = i / (half - 1);
        positions.push({ x: cx - r * 0.45 + t * r * 0.9, y: cy - r * 0.45 + t * r * 0.9 });
      }
      for (let i = 0; i < count - half; i++) {
        const t = i / (count - half - 1);
        positions.push({ x: cx + r * 0.45 - t * r * 0.9, y: cy - r * 0.45 + t * r * 0.9 });
      }
      break;
    }
    default: {
      // Fallback to scatter
      for (let i = 0; i < count; i++) {
        const angle = i * goldenAngle;
        const dist = r * (0.15 + (i / count) * 0.78);
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
    }
  }

  return positions;
}

export function NeuralMorph({
  size = 120,
  dotCount = 16,
  formation: externalFormation,
  className = "",
  onFormationChange,
}: {
  size?: number;
  dotCount?: number;
  formation?: Formation;
  className?: string;
  onFormationChange?: (f: Formation) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const currentFormationRef = useRef<Formation>(externalFormation ?? "scatter");
  const [currentFormation, setCurrentFormation] = useState<Formation>(externalFormation ?? "scatter");

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Initialize dots
  useEffect(() => {
    const positions = getFormationPositions("scatter", dotCount, cx, cy, r);
    dotsRef.current = positions.map((p, i) => ({
      x: p.x, y: p.y,
      targetX: p.x, targetY: p.y,
      size: 1.5 + (i % 3) * 0.5,
      opacity: 0.3 + Math.random() * 0.4,
      targetOpacity: 0.5,
    }));
  }, [dotCount, cx, cy, r]);

  // Update targets when formation changes
  const morphTo = useCallback((formation: Formation) => {
    const positions = getFormationPositions(formation, dotCount, cx, cy, r);
    dotsRef.current.forEach((dot, i) => {
      if (positions[i]) {
        dot.targetX = positions[i].x;
        dot.targetY = positions[i].y;
        dot.targetOpacity = formation === "scatter" ? 0.3 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3;
      }
    });
    currentFormationRef.current = formation;
    setCurrentFormation(formation);
    onFormationChange?.(formation);
  }, [dotCount, cx, cy, r, onFormationChange]);

  // Sync with external formation prop
  useEffect(() => {
    if (externalFormation && externalFormation !== currentFormation) {
      morphTo(externalFormation);
    }
  }, [externalFormation, currentFormation, morphTo]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    function draw() {
      ctx.clearRect(0, 0, size, size);
      timeRef.current += 0.016;
      const dots = dotsRef.current;
      const easing = 0.06; // Smooth easing

      // For animated formations, continuously update targets
      if (ANIMATED_FORMATIONS.has(currentFormationRef.current)) {
        const positions = getFormationPositions(currentFormationRef.current, dotCount, cx, cy, r, timeRef.current);
        dots.forEach((dot, i) => {
          if (positions[i]) {
            dot.targetX = positions[i].x;
            dot.targetY = positions[i].y;
          }
        });
      }

      // Update positions with easing
      dots.forEach((dot) => {
        dot.x += (dot.targetX - dot.x) * easing;
        dot.y += (dot.targetY - dot.y) * easing;
        dot.opacity += (dot.targetOpacity - dot.opacity) * easing;
      });

      // Draw connections
      dots.forEach((dot, i) => {
        // Connect to nearest 2-3 dots
        const next = dots[(i + 1) % dots.length];
        const skip = dots[(i + 2) % dots.length];

        const d1 = Math.hypot(dot.x - next.x, dot.y - next.y);
        if (d1 < size * 0.5) {
          const alpha = 0.12 * (1 - d1 / (size * 0.5));
          ctx.strokeStyle = `rgba(52,211,153,${alpha})`;
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(dot.x, dot.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }

        const d2 = Math.hypot(dot.x - skip.x, dot.y - skip.y);
        if (d2 < size * 0.4) {
          const alpha = 0.06 * (1 - d2 / (size * 0.4));
          ctx.strokeStyle = `rgba(52,211,153,${alpha})`;
          ctx.lineWidth = 0.2;
          ctx.beginPath();
          ctx.moveTo(dot.x, dot.y);
          ctx.lineTo(skip.x, skip.y);
          ctx.stroke();
        }

        // Center connection
        const dc = Math.hypot(dot.x - cx, dot.y - cy);
        if (dc < size * 0.45) {
          const alpha = 0.04 * (1 - dc / (size * 0.45));
          ctx.strokeStyle = `rgba(52,211,153,${alpha})`;
          ctx.lineWidth = 0.15;
          ctx.beginPath();
          ctx.moveTo(dot.x, dot.y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }
      });

      // Draw dots with subtle oscillation
      dots.forEach((dot, i) => {
        const pulse = Math.sin(timeRef.current * 2 + i * 0.5) * 0.15;

        // Glow
        ctx.fillStyle = `rgba(52,211,153,${(dot.opacity * 0.2 + pulse * 0.1).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = `rgba(52,211,153,${(dot.opacity + pulse).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size + pulse * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Center node
      const centerPulse = Math.sin(timeRef.current * 1.5) * 0.15;
      ctx.fillStyle = `rgba(52,211,153,${(0.5 + centerPulse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5 + centerPulse, 0, Math.PI * 2);
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [size, cx, cy]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

export const FORMATIONS: Formation[] = [
  "idle", "active", "done", "error",
  "scatter", "ring", "spiral", "galaxy", "orbit", "helix", "flow", "bloom",
  "triangle", "hexagon", "star", "infinity", "grid",
  "breathe", "pulse", "converge", "disperse", "vortex", "wave",
  "heart", "check", "cross",
];
