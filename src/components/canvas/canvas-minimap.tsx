"use client";

import { useCallback, type RefObject } from "react";
import type { CanvasItem } from "./canvas-workspace";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasMinimapProps {
  items: CanvasItem[];
  viewport: Viewport;
  containerRef: RefObject<HTMLDivElement | null>;
  onViewportChange: (viewport: Viewport) => void;
}

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 100;
const PADDING = 50;

export function CanvasMinimap({
  items,
  viewport,
  containerRef,
  onViewportChange,
}: CanvasMinimapProps) {
  if (items.length === 0) return null;

  // Calculate content bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const scale = Math.min(
    MINIMAP_WIDTH / contentWidth,
    MINIMAP_HEIGHT / contentHeight
  );

  // Viewport rectangle in content coordinates
  const rect = containerRef.current?.getBoundingClientRect();
  const vpWidth = rect ? rect.width / viewport.zoom : 800;
  const vpHeight = rect ? rect.height / viewport.zoom : 600;
  const vpX = -viewport.x / viewport.zoom;
  const vpY = -viewport.y / viewport.zoom;

  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bounds = e.currentTarget.getBoundingClientRect();
      const clickX = (e.clientX - bounds.left) / scale + minX;
      const clickY = (e.clientY - bounds.top) / scale + minY;

      const newVp = {
        ...viewport,
        x: -(clickX - vpWidth / 2) * viewport.zoom,
        y: -(clickY - vpHeight / 2) * viewport.zoom,
      };
      onViewportChange(newVp);
    },
    [scale, minX, minY, viewport, vpWidth, vpHeight, onViewportChange]
  );

  return (
    <div
      className="absolute bottom-4 right-4 z-20 rounded-md border bg-card/90 backdrop-blur-sm shadow-sm overflow-hidden cursor-pointer"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onClick={handleMinimapClick}
    >
      {/* Items as dots */}
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute rounded-[1px]"
          style={{
            left: `${(item.x - minX) * scale}px`,
            top: `${(item.y - minY) * scale}px`,
            width: `${Math.max(3, item.width * scale)}px`,
            height: `${Math.max(2, item.height * scale)}px`,
            backgroundColor:
              item.item_type === "note"
                ? "hsl(48, 96%, 53%)"
                : item.item_type === "label"
                  ? "hsl(var(--foreground))"
                  : "hsl(var(--primary))",
            opacity: 0.6,
          }}
        />
      ))}

      {/* Viewport indicator */}
      <div
        className="absolute border-2 border-primary/60 rounded-sm"
        style={{
          left: `${(vpX - minX) * scale}px`,
          top: `${(vpY - minY) * scale}px`,
          width: `${vpWidth * scale}px`,
          height: `${vpHeight * scale}px`,
        }}
      />
    </div>
  );
}
