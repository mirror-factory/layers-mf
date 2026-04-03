"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type Formation =
  | "scatter" | "ring" | "breathe" | "triangle" | "square" | "hexagon" | "spiral" | "grid"
  | "tornado" | "wave" | "explode" | "implode" | "dna" | "infinity" | "heart" | "star"
  | "smile" | "thinking" | "check" | "cross" | "pulse" | "orbit" | "galaxy" | "rain";

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
    case "tornado": {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 6;
        const dist = r * (0.05 + t * 0.85);
        positions.push({
          x: cx + Math.cos(angle) * dist * (0.3 + t * 0.7),
          y: cy - r + t * r * 2,
        });
      }
      break;
    }
    case "wave": {
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        positions.push({
          x: cx - r * 0.8 + t * r * 1.6,
          y: cy + Math.sin(t * Math.PI * 3) * r * 0.4,
        });
      }
      break;
    }
    case "explode": {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + i * 0.3;
        positions.push({
          x: cx + Math.cos(angle) * r * 0.95,
          y: cy + Math.sin(angle) * r * 0.95,
        });
      }
      break;
    }
    case "implode": {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = r * 0.05 + (i % 3) * r * 0.03;
        positions.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
        });
      }
      break;
    }
    case "dna": {
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const strand = i % 2;
        const angle = t * Math.PI * 4;
        positions.push({
          x: cx + Math.cos(angle + strand * Math.PI) * r * 0.35,
          y: cy - r * 0.8 + t * r * 1.6,
        });
      }
      break;
    }
    case "infinity": {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const scale = r * 0.45;
        positions.push({
          x: cx + scale * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t)),
          y: cy + scale * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t)),
        });
      }
      break;
    }
    case "heart": {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const scale = r * 0.04;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        positions.push({
          x: cx + hx * scale,
          y: cy + hy * scale + r * 0.1,
        });
      }
      break;
    }
    case "star": {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const pointy = i % 2 === 0 ? r * 0.75 : r * 0.35;
        positions.push({
          x: cx + Math.cos(angle) * pointy,
          y: cy + Math.sin(angle) * pointy,
        });
      }
      break;
    }
    case "smile": {
      const eyeL = Math.floor(count * 0.15);
      const eyeR = Math.floor(count * 0.15);
      const mouth = count - eyeL - eyeR;
      // Left eye
      for (let i = 0; i < eyeL; i++) {
        const a = (i / eyeL) * Math.PI * 2;
        positions.push({ x: cx - r * 0.3 + Math.cos(a) * r * 0.1, y: cy - r * 0.2 + Math.sin(a) * r * 0.1 });
      }
      // Right eye
      for (let i = 0; i < eyeR; i++) {
        const a = (i / eyeR) * Math.PI * 2;
        positions.push({ x: cx + r * 0.3 + Math.cos(a) * r * 0.1, y: cy - r * 0.2 + Math.sin(a) * r * 0.1 });
      }
      // Smile arc
      for (let i = 0; i < mouth; i++) {
        const t = i / (mouth - 1);
        const angle = Math.PI * 0.2 + t * Math.PI * 0.6;
        positions.push({ x: cx + Math.cos(angle) * r * 0.5, y: cy + Math.sin(angle) * r * 0.35 });
      }
      break;
    }
    case "thinking": {
      // Dots clustered top-right like a thought bubble
      for (let i = 0; i < count; i++) {
        const t = i / count;
        if (i < count * 0.7) {
          const a = (i / (count * 0.7)) * Math.PI * 2;
          positions.push({ x: cx + r * 0.1 + Math.cos(a) * r * 0.5, y: cy - r * 0.1 + Math.sin(a) * r * 0.45 });
        } else {
          // Small trailing bubbles
          const bubbleIdx = i - Math.floor(count * 0.7);
          const bubbleR = r * (0.2 - bubbleIdx * 0.05);
          positions.push({ x: cx - r * 0.4 - bubbleIdx * r * 0.15, y: cy + r * 0.5 + bubbleIdx * r * 0.12 });
        }
      }
      break;
    }
    case "check": {
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        if (t < 0.4) {
          const lt = t / 0.4;
          positions.push({ x: cx - r * 0.5 + lt * r * 0.4, y: cy + lt * r * 0.4 });
        } else {
          const lt = (t - 0.4) / 0.6;
          positions.push({ x: cx - r * 0.1 + lt * r * 0.7, y: cy + r * 0.4 - lt * r * 0.8 });
        }
      }
      break;
    }
    case "cross": {
      const half = Math.floor(count / 2);
      for (let i = 0; i < half; i++) {
        const t = i / (half - 1);
        positions.push({ x: cx - r * 0.5 + t * r, y: cy - r * 0.5 + t * r });
      }
      for (let i = 0; i < count - half; i++) {
        const t = i / (count - half - 1);
        positions.push({ x: cx + r * 0.5 - t * r, y: cy - r * 0.5 + t * r });
      }
      break;
    }
    case "pulse": {
      // All dots at center, will animate outward via breathe logic
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = r * 0.08;
        positions.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
      }
      break;
    }
    case "orbit": {
      // 3 concentric rings rotating
      const rings = [0.25, 0.5, 0.75];
      for (let i = 0; i < count; i++) {
        const ringIdx = i % 3;
        const ringR = rings[ringIdx] * r;
        const dotsInRing = Math.ceil(count / 3);
        const posInRing = Math.floor(i / 3);
        const angle = (posInRing / dotsInRing) * Math.PI * 2 + ringIdx * 0.5;
        positions.push({ x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR });
      }
      break;
    }
    case "galaxy": {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const arm = i % 2;
        const angle = t * Math.PI * 3 + arm * Math.PI;
        const dist = r * (0.1 + t * 0.8);
        const wobble = Math.sin(i * 2.5) * r * 0.08;
        positions.push({
          x: cx + Math.cos(angle) * dist + wobble,
          y: cy + Math.sin(angle) * dist * 0.6 + wobble,
        });
      }
      break;
    }
    case "rain": {
      for (let i = 0; i < count; i++) {
        const col = i % Math.ceil(Math.sqrt(count));
        const colSpacing = (r * 1.6) / Math.ceil(Math.sqrt(count));
        positions.push({
          x: cx - r * 0.8 + col * colSpacing + Math.random() * 4,
          y: cy - r + (i / count) * r * 2,
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

export const FORMATIONS: Formation[] = [
  // Shapes
  "scatter", "ring", "triangle", "square", "hexagon", "star", "heart", "infinity",
  // Motion
  "spiral", "tornado", "wave", "dna", "galaxy", "orbit",
  // States
  "explode", "implode", "pulse", "breathe", "rain",
  // Expressions
  "smile", "thinking", "check", "cross",
  // Grid
  "grid",
];
