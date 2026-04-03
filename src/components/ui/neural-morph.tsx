"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type Formation = "scatter" | "ring" | "breathe" | "triangle" | "square" | "hexagon" | "spiral" | "grid";

interface Dot {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  opacity: number;
  targetOpacity: number;
}

function getFormationPositions(formation: Formation, count: number, cx: number, cy: number, r: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  switch (formation) {
    case "scatter": {
      for (let i = 0; i < count; i++) {
        const angle = i * goldenAngle;
        const dist = r * (0.15 + (i / count) * 0.8);
        positions.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
        });
      }
      break;
    }
    case "ring": {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        positions.push({
          x: cx + Math.cos(angle) * r * 0.7,
          y: cy + Math.sin(angle) * r * 0.7,
        });
      }
      break;
    }
    case "breathe": {
      // Same as scatter but will animate radius in/out
      for (let i = 0; i < count; i++) {
        const angle = i * goldenAngle;
        const dist = r * (0.3 + (i / count) * 0.55);
        positions.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
        });
      }
      break;
    }
    case "triangle": {
      const sides = 3;
      for (let i = 0; i < count; i++) {
        const sideIdx = i % sides;
        const t = Math.floor(i / sides) / Math.ceil(count / sides);
        const a1 = (sideIdx / sides) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((sideIdx + 1) / sides) * Math.PI * 2 - Math.PI / 2;
        positions.push({
          x: cx + (Math.cos(a1) * (1 - t) + Math.cos(a2) * t) * r * 0.7,
          y: cy + (Math.sin(a1) * (1 - t) + Math.sin(a2) * t) * r * 0.7,
        });
      }
      break;
    }
    case "square": {
      const sides = 4;
      for (let i = 0; i < count; i++) {
        const sideIdx = i % sides;
        const t = Math.floor(i / sides) / Math.ceil(count / sides);
        const a1 = (sideIdx / sides) * Math.PI * 2 - Math.PI / 4;
        const a2 = ((sideIdx + 1) / sides) * Math.PI * 2 - Math.PI / 4;
        positions.push({
          x: cx + (Math.cos(a1) * (1 - t) + Math.cos(a2) * t) * r * 0.65,
          y: cy + (Math.sin(a1) * (1 - t) + Math.sin(a2) * t) * r * 0.65,
        });
      }
      break;
    }
    case "hexagon": {
      const sides = 6;
      for (let i = 0; i < count; i++) {
        const sideIdx = i % sides;
        const t = Math.floor(i / sides) / Math.ceil(count / sides);
        const a1 = (sideIdx / sides) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((sideIdx + 1) / sides) * Math.PI * 2 - Math.PI / 2;
        positions.push({
          x: cx + (Math.cos(a1) * (1 - t) + Math.cos(a2) * t) * r * 0.7,
          y: cy + (Math.sin(a1) * (1 - t) + Math.sin(a2) * t) * r * 0.7,
        });
      }
      break;
    }
    case "spiral": {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 4; // 2 full rotations
        const dist = r * (0.1 + t * 0.75);
        positions.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
        });
      }
      break;
    }
    case "grid": {
      const cols = Math.ceil(Math.sqrt(count));
      const spacing = (r * 1.4) / cols;
      const offset = (cols - 1) * spacing / 2;
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
          x: cx - offset + col * spacing,
          y: cy - offset + row * spacing,
        });
      }
      break;
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
      const easing = 0.04; // Smooth easing — lower = slower morph

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

export const FORMATIONS: Formation[] = ["scatter", "ring", "breathe", "triangle", "square", "hexagon", "spiral", "grid"];
