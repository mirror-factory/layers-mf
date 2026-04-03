"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type Formation =
  // Shapes
  | "scatter" | "ring" | "triangle" | "square" | "hexagon" | "star" | "heart" | "infinity"
  // Motion (animated)
  | "spiral" | "tornado" | "wave" | "dna" | "galaxy" | "orbit"
  // States
  | "explode" | "implode" | "pulse" | "breathe" | "rain" | "grid"
  // Expressions
  | "smile" | "thinking" | "check" | "cross"
  // Faces
  | "wink" | "surprised" | "sleep" | "happy" | "sad" | "cool"
  // Tool animations (animated continuously)
  | "searching" | "writing" | "coding" | "reading" | "sending" | "loading";

interface Dot {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  opacity: number;
  targetOpacity: number;
}

// Formations that animate continuously (targets update every frame)
const ANIMATED_FORMATIONS = new Set<Formation>(["tornado", "orbit", "galaxy", "wave", "dna", "breathe", "rain", "pulse", "searching", "writing", "coding", "reading", "sending", "loading"]);

function getFormationPositions(formation: Formation, count: number, cx: number, cy: number, r: number, time = 0): { x: number; y: number }[] {
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
      const rings = [0.25, 0.5, 0.75];
      const speeds = [1, -0.7, 0.4]; // Different rotation speeds per ring
      for (let i = 0; i < count; i++) {
        const ringIdx = i % 3;
        const ringR = rings[ringIdx] * r;
        const dotsInRing = Math.ceil(count / 3);
        const posInRing = Math.floor(i / 3);
        const angle = (posInRing / dotsInRing) * Math.PI * 2 + ringIdx * 0.5 + time * speeds[ringIdx];
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
        const yOffset = (time * 30 + i * 20) % (r * 2);
        positions.push({
          x: cx - r * 0.8 + col * colSpacing,
          y: cy - r + yOffset,
        });
      }
      break;
    }
    // === FACES ===
    case "wink": {
      const parts = { leftEye: Math.floor(count * 0.1), rightEye: Math.floor(count * 0.15), mouth: 0 };
      parts.mouth = count - parts.leftEye - parts.rightEye;
      let idx = 0;
      // Left eye (closed — horizontal line)
      for (let i = 0; i < parts.leftEye; i++) {
        const t = i / (parts.leftEye - 1);
        positions.push({ x: cx - r * 0.4 + t * r * 0.15, y: cy - r * 0.2 });
        idx++;
      }
      // Right eye (open — circle)
      for (let i = 0; i < parts.rightEye; i++) {
        const a = (i / parts.rightEye) * Math.PI * 2;
        positions.push({ x: cx + r * 0.3 + Math.cos(a) * r * 0.1, y: cy - r * 0.2 + Math.sin(a) * r * 0.1 });
        idx++;
      }
      // Smile
      for (let i = 0; i < parts.mouth; i++) {
        const t = i / (parts.mouth - 1);
        const angle = Math.PI * 0.15 + t * Math.PI * 0.7;
        positions.push({ x: cx + Math.cos(angle) * r * 0.45, y: cy + Math.sin(angle) * r * 0.3 });
      }
      break;
    }
    case "surprised": {
      const eyeCount = Math.floor(count * 0.15);
      const mouthCount = count - eyeCount * 2;
      // Left eye (circle)
      for (let i = 0; i < eyeCount; i++) {
        const a = (i / eyeCount) * Math.PI * 2;
        positions.push({ x: cx - r * 0.3 + Math.cos(a) * r * 0.1, y: cy - r * 0.25 + Math.sin(a) * r * 0.1 });
      }
      // Right eye (circle)
      for (let i = 0; i < eyeCount; i++) {
        const a = (i / eyeCount) * Math.PI * 2;
        positions.push({ x: cx + r * 0.3 + Math.cos(a) * r * 0.1, y: cy - r * 0.25 + Math.sin(a) * r * 0.1 });
      }
      // O mouth (circle)
      for (let i = 0; i < mouthCount; i++) {
        const a = (i / mouthCount) * Math.PI * 2;
        positions.push({ x: cx + Math.cos(a) * r * 0.15, y: cy + r * 0.25 + Math.sin(a) * r * 0.15 });
      }
      break;
    }
    case "sleep": {
      const eyeCount = Math.floor(count * 0.15);
      const zCount = count - eyeCount * 2;
      // Left eye (closed line)
      for (let i = 0; i < eyeCount; i++) {
        const t = i / (eyeCount - 1);
        positions.push({ x: cx - r * 0.4 + t * r * 0.2, y: cy - r * 0.15 });
      }
      // Right eye (closed line)
      for (let i = 0; i < eyeCount; i++) {
        const t = i / (eyeCount - 1);
        positions.push({ x: cx + r * 0.2 + t * r * 0.2, y: cy - r * 0.15 });
      }
      // Z z z (floating up and right)
      for (let i = 0; i < zCount; i++) {
        const t = i / zCount;
        positions.push({ x: cx + r * 0.3 + t * r * 0.4, y: cy - r * 0.3 - t * r * 0.5 + Math.sin(time * 2 + i) * 3 });
      }
      break;
    }
    case "happy": {
      const eyeCount = Math.floor(count * 0.12);
      const mouth = count - eyeCount * 2;
      // Left eye (^)
      for (let i = 0; i < eyeCount; i++) {
        const t = i / (eyeCount - 1);
        const y = cy - r * 0.25 - Math.sin(t * Math.PI) * r * 0.12;
        positions.push({ x: cx - r * 0.4 + t * r * 0.2, y });
      }
      // Right eye (^)
      for (let i = 0; i < eyeCount; i++) {
        const t = i / (eyeCount - 1);
        const y = cy - r * 0.25 - Math.sin(t * Math.PI) * r * 0.12;
        positions.push({ x: cx + r * 0.2 + t * r * 0.2, y });
      }
      // Big smile
      for (let i = 0; i < mouth; i++) {
        const t = i / (mouth - 1);
        const angle = Math.PI * 0.1 + t * Math.PI * 0.8;
        positions.push({ x: cx + Math.cos(angle) * r * 0.5, y: cy + r * 0.05 + Math.sin(angle) * r * 0.35 });
      }
      break;
    }
    case "sad": {
      const eyeCount = Math.floor(count * 0.12);
      const mouth = count - eyeCount * 2;
      // Eyes (dots)
      for (let i = 0; i < eyeCount; i++) {
        const a = (i / eyeCount) * Math.PI * 2;
        positions.push({ x: cx - r * 0.3 + Math.cos(a) * r * 0.05, y: cy - r * 0.15 + Math.sin(a) * r * 0.05 });
      }
      for (let i = 0; i < eyeCount; i++) {
        const a = (i / eyeCount) * Math.PI * 2;
        positions.push({ x: cx + r * 0.3 + Math.cos(a) * r * 0.05, y: cy - r * 0.15 + Math.sin(a) * r * 0.05 });
      }
      // Frown (inverted arc)
      for (let i = 0; i < mouth; i++) {
        const t = i / (mouth - 1);
        const angle = -Math.PI * 0.1 - t * Math.PI * 0.8;
        positions.push({ x: cx + Math.cos(angle) * r * 0.4, y: cy + r * 0.35 - Math.sin(angle) * r * 0.2 });
      }
      break;
    }
    case "cool": {
      const glassCount = Math.floor(count * 0.4);
      const mouth = count - glassCount;
      // Sunglasses (two connected rectangles-ish)
      for (let i = 0; i < glassCount; i++) {
        const t = i / (glassCount - 1);
        const x = cx - r * 0.55 + t * r * 1.1;
        const y = cy - r * 0.2 + (Math.abs(x - cx) < r * 0.08 ? 0 : Math.sin(t * Math.PI * 2) * r * 0.08);
        positions.push({ x, y });
      }
      // Slight smirk
      for (let i = 0; i < mouth; i++) {
        const t = i / (mouth - 1);
        positions.push({ x: cx - r * 0.2 + t * r * 0.5, y: cy + r * 0.3 + t * r * 0.05 });
      }
      break;
    }
    // === TOOL ANIMATIONS (use time for continuous motion) ===
    case "searching": {
      // Magnifying glass that sweeps
      const handleCount = Math.floor(count * 0.3);
      const lensCount = count - handleCount;
      const sweepAngle = Math.sin(time * 1.5) * 0.3;
      // Lens circle
      for (let i = 0; i < lensCount; i++) {
        const a = (i / lensCount) * Math.PI * 2;
        positions.push({
          x: cx - r * 0.1 + Math.cos(a + sweepAngle) * r * 0.35,
          y: cy - r * 0.1 + Math.sin(a + sweepAngle) * r * 0.35,
        });
      }
      // Handle
      for (let i = 0; i < handleCount; i++) {
        const t = i / (handleCount - 1);
        positions.push({
          x: cx + r * 0.2 + t * r * 0.4,
          y: cy + r * 0.2 + t * r * 0.4,
        });
      }
      break;
    }
    case "writing": {
      // Pen writing lines
      const penTip = Math.floor(count * 0.15);
      const lines = count - penTip;
      const writeProgress = (Math.sin(time * 2) + 1) / 2;
      // Lines (appearing)
      for (let i = 0; i < lines; i++) {
        const lineIdx = Math.floor(i / Math.ceil(lines / 3));
        const linePos = (i % Math.ceil(lines / 3)) / Math.ceil(lines / 3);
        const visible = linePos < writeProgress || lineIdx < Math.floor(writeProgress * 3);
        positions.push({
          x: cx - r * 0.6 + linePos * r * 1.2,
          y: cy - r * 0.3 + lineIdx * r * 0.3,
        });
      }
      // Pen tip
      for (let i = 0; i < penTip; i++) {
        const a = (i / penTip) * Math.PI * 2;
        positions.push({
          x: cx - r * 0.6 + writeProgress * r * 1.2 + Math.cos(a) * 2,
          y: cy - r * 0.3 + Math.floor(writeProgress * 3) * r * 0.3 + Math.sin(a) * 2,
        });
      }
      break;
    }
    case "coding": {
      // Code brackets < > with cursor blinking
      const bracketCount = Math.floor(count * 0.3);
      const codeLines = count - bracketCount;
      const cursorBlink = Math.sin(time * 4) > 0;
      // Left bracket <
      for (let i = 0; i < Math.floor(bracketCount / 2); i++) {
        const t = i / (Math.floor(bracketCount / 2) - 1);
        const x = t < 0.5 ? cx - r * 0.6 + t * r * 0.3 : cx - r * 0.45 - (t - 0.5) * r * 0.3;
        const y = cy - r * 0.4 + t * r * 0.8;
        positions.push({ x, y: y - r * 0.1 });
      }
      // Right bracket >
      for (let i = 0; i < Math.ceil(bracketCount / 2); i++) {
        const t = i / (Math.ceil(bracketCount / 2) - 1);
        const x = t < 0.5 ? cx + r * 0.3 + t * r * 0.3 : cx + r * 0.45 + (t - 0.5) * r * 0.3;
        const y = cy - r * 0.4 + t * r * 0.8;
        positions.push({ x, y: y - r * 0.1 });
      }
      // Code lines inside
      for (let i = 0; i < codeLines; i++) {
        const lineIdx = Math.floor(i / 4);
        const charIdx = i % 4;
        positions.push({
          x: cx - r * 0.2 + charIdx * r * 0.12,
          y: cy - r * 0.2 + lineIdx * r * 0.15,
        });
      }
      break;
    }
    case "reading": {
      // Open book shape with scanning line
      const scanY = cy + Math.sin(time * 1.5) * r * 0.3;
      const bookDots = Math.floor(count * 0.7);
      const scanDots = count - bookDots;
      // Book pages (two rectangles)
      for (let i = 0; i < bookDots; i++) {
        const page = i < bookDots / 2 ? -1 : 1;
        const idx = i < bookDots / 2 ? i : i - Math.floor(bookDots / 2);
        const perPage = Math.floor(bookDots / 2);
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        positions.push({
          x: cx + page * r * 0.15 + page * col * r * 0.15,
          y: cy - r * 0.4 + row * r * 0.15,
        });
      }
      // Scanning highlight line
      for (let i = 0; i < scanDots; i++) {
        const t = i / (scanDots - 1);
        positions.push({ x: cx - r * 0.4 + t * r * 0.8, y: scanY });
      }
      break;
    }
    case "sending": {
      // Paper plane flying
      const planeTime = time * 2;
      const flyX = Math.sin(planeTime) * r * 0.3;
      const flyY = Math.cos(planeTime * 0.7) * r * 0.2;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        if (t < 0.4) {
          // Leading edge
          const lt = t / 0.4;
          positions.push({ x: cx + flyX + lt * r * 0.5, y: cy + flyY - lt * r * 0.15 });
        } else if (t < 0.7) {
          // Top wing
          const lt = (t - 0.4) / 0.3;
          positions.push({ x: cx + flyX + r * 0.5 - lt * r * 0.6, y: cy + flyY - r * 0.15 - lt * r * 0.2 });
        } else {
          // Bottom wing
          const lt = (t - 0.7) / 0.3;
          positions.push({ x: cx + flyX + r * 0.5 - lt * r * 0.6, y: cy + flyY - r * 0.15 + lt * r * 0.2 });
        }
      }
      break;
    }
    case "loading": {
      // Rotating dots in a circle (classic spinner)
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + time * 3;
        positions.push({
          x: cx + Math.cos(angle) * r * 0.5,
          y: cy + Math.sin(angle) * r * 0.5,
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
  // Shapes
  "scatter", "ring", "triangle", "square", "hexagon", "star", "heart", "infinity",
  // Motion (animated)
  "spiral", "tornado", "wave", "dna", "galaxy", "orbit", "loading",
  // States
  "explode", "implode", "pulse", "breathe", "rain", "grid",
  // Faces
  "smile", "wink", "happy", "sad", "surprised", "cool", "sleep", "thinking",
  // Symbols
  "check", "cross",
  // Tool animations
  "searching", "writing", "coding", "reading", "sending",
];
