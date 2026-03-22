"use client";

import type { CanvasItem, CanvasConnection } from "./canvas-workspace";

interface CanvasConnectionsProps {
  items: CanvasItem[];
  connections: CanvasConnection[];
}

export function CanvasConnections({
  items,
  connections,
}: CanvasConnectionsProps) {
  if (connections.length === 0) return null;

  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Calculate bounding box for SVG
  let minX = 0,
    minY = 0,
    maxX = 2000,
    maxY = 2000;
  for (const item of items) {
    minX = Math.min(minX, item.x - 50);
    minY = Math.min(minY, item.y - 50);
    maxX = Math.max(maxX, item.x + item.width + 50);
    maxY = Math.max(maxY, item.y + item.height + 50);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${width}px`,
        height: `${height}px`,
        overflow: "visible",
      }}
    >
      {connections.map((conn) => {
        const fromItem = itemMap.get(conn.from_item_id);
        const toItem = itemMap.get(conn.to_item_id);
        if (!fromItem || !toItem) return null;

        // Center of each item
        const fromX = fromItem.x + fromItem.width / 2 - minX;
        const fromY = fromItem.y + fromItem.height / 2 - minY;
        const toX = toItem.x + toItem.width / 2 - minX;
        const toY = toItem.y + toItem.height / 2 - minY;
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;

        return (
          <g key={conn.id}>
            <line
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeOpacity={0.4}
            />
            {conn.label && (
              <text
                x={midX}
                y={midY - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
                opacity={0.7}
              >
                {conn.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
