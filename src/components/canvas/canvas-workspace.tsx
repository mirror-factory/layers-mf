"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MouseEvent,
  type WheelEvent,
} from "react";
import { CanvasItemCard } from "./canvas-item-card";
import { CanvasConnections } from "./canvas-connections";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasMinimap } from "./canvas-minimap";

// ---- Types ----

export interface CanvasItem {
  id: string;
  context_item_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  style: Record<string, unknown>;
  item_type: "context" | "note" | "label" | "group";
  content: string | null;
  created_at: string;
  updated_at: string;
  // Joined context data (populated client-side for context items)
  title?: string;
  description_short?: string;
  source_type?: string;
  content_type?: string;
}

export interface CanvasConnection {
  id: string;
  from_item_id: string;
  to_item_id: string;
  label: string | null;
  style: Record<string, unknown>;
  created_at: string;
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const SAVE_DEBOUNCE_MS = 1000;

export interface CanvasWorkspaceProps {
  canvasId: string;
}

export function CanvasWorkspace({ canvasId }: CanvasWorkspaceProps) {
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [canvasName, setCanvasName] = useState("");
  const [loading, setLoading] = useState(true);

  // Drag state
  const [dragging, setDragging] = useState<{
    itemId: string;
    startMouseX: number;
    startMouseY: number;
    startItemX: number;
    startItemY: number;
  } | null>(null);

  // Pan state
  const [panning, setPanning] = useState<{
    startMouseX: number;
    startMouseY: number;
    startViewX: number;
    startViewY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load canvas data ----
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/canvases/${canvasId}`);
        if (!res.ok) return;
        const data = await res.json();
        setCanvasName(data.name ?? "");
        if (data.viewport) {
          setViewport(data.viewport);
        }
        setItems(data.items ?? []);
        setConnections(data.connections ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [canvasId]);

  // ---- Debounced save helpers ----

  const saveItemPosition = useCallback(
    (itemId: string, x: number, y: number) => {
      fetch(`/api/canvases/${canvasId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, x, y }),
      });
    },
    [canvasId]
  );

  const saveViewport = useCallback(
    (vp: Viewport) => {
      if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
      viewportSaveTimerRef.current = setTimeout(() => {
        fetch(`/api/canvases/${canvasId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewport: vp }),
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [canvasId]
  );

  const saveCanvasName = useCallback(
    (name: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(`/api/canvases/${canvasId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [canvasId]
  );

  // ---- Mouse handlers ----

  const handleCanvasMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // Only start pan on the canvas background (not on items)
      if ((e.target as HTMLElement).closest("[data-canvas-item]")) return;
      setSelectedItem(null);
      setPanning({
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startViewX: viewport.x,
        startViewY: viewport.y,
      });
    },
    [viewport.x, viewport.y]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (panning) {
        const dx = e.clientX - panning.startMouseX;
        const dy = e.clientY - panning.startMouseY;
        const newVp = {
          ...viewport,
          x: panning.startViewX + dx,
          y: panning.startViewY + dy,
        };
        setViewport(newVp);
        return;
      }

      if (dragging) {
        const dx = (e.clientX - dragging.startMouseX) / viewport.zoom;
        const dy = (e.clientY - dragging.startMouseY) / viewport.zoom;
        const newX = dragging.startItemX + dx;
        const newY = dragging.startItemY + dy;

        setItems((prev) =>
          prev.map((item) =>
            item.id === dragging.itemId
              ? { ...item, x: newX, y: newY }
              : item
          )
        );
      }
    },
    [panning, dragging, viewport]
  );

  const handleMouseUp = useCallback(() => {
    if (panning) {
      saveViewport(viewport);
      setPanning(null);
    }
    if (dragging) {
      const item = items.find((i) => i.id === dragging.itemId);
      if (item) {
        saveItemPosition(dragging.itemId, item.x, item.y);
      }
      setDragging(null);
    }
  }, [panning, dragging, viewport, items, saveViewport, saveItemPosition]);

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom + delta));

      // Zoom toward cursor
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const scale = newZoom / viewport.zoom;
        const newX = cx - (cx - viewport.x) * scale;
        const newY = cy - (cy - viewport.y) * scale;
        const newVp = { x: newX, y: newY, zoom: newZoom };
        setViewport(newVp);
        saveViewport(newVp);
      } else {
        const newVp = { ...viewport, zoom: newZoom };
        setViewport(newVp);
        saveViewport(newVp);
      }
    },
    [viewport, saveViewport]
  );

  // ---- Item interactions ----

  const handleItemMouseDown = useCallback(
    (itemId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedItem(itemId);
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      setDragging({
        itemId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startItemX: item.x,
        startItemY: item.y,
      });
    },
    [items]
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setConnections((prev) =>
        prev.filter((c) => c.from_item_id !== itemId && c.to_item_id !== itemId)
      );
      setSelectedItem(null);
      await fetch(`/api/canvases/${canvasId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
    },
    [canvasId]
  );

  const handleUpdateItemContent = useCallback(
    (itemId: string, content: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, content } : item
        )
      );
      // Debounced save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(`/api/canvases/${canvasId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, content }),
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [canvasId]
  );

  // ---- Add items ----

  const addItem = useCallback(
    async (
      itemType: "context" | "note" | "label",
      options?: {
        contextItemId?: string;
        content?: string;
        title?: string;
        description_short?: string;
        source_type?: string;
        content_type?: string;
      }
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const centerX = rect
        ? (rect.width / 2 - viewport.x) / viewport.zoom
        : 400;
      const centerY = rect
        ? (rect.height / 2 - viewport.y) / viewport.zoom
        : 300;

      // Offset slightly randomly to avoid stacking
      const x = centerX + (Math.random() - 0.5) * 60;
      const y = centerY + (Math.random() - 0.5) * 60;

      const width = itemType === "label" ? 200 : itemType === "note" ? 240 : 280;
      const height = itemType === "label" ? 40 : itemType === "note" ? 160 : 180;

      const body: Record<string, unknown> = {
        x,
        y,
        width,
        height,
        itemType,
      };
      if (options?.contextItemId) body.contextItemId = options.contextItemId;
      if (options?.content) body.content = options.content;

      const res = await fetch(`/api/canvases/${canvasId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) return;
      const newItem = await res.json();
      // Merge in context metadata for display
      const enrichedItem: CanvasItem = {
        ...newItem,
        title: options?.title,
        description_short: options?.description_short,
        source_type: options?.source_type,
        content_type: options?.content_type,
      };
      setItems((prev) => [...prev, enrichedItem]);
      setSelectedItem(newItem.id);
    },
    [canvasId, viewport]
  );

  // ---- Zoom controls ----

  const zoomIn = useCallback(() => {
    const newVp = {
      ...viewport,
      zoom: Math.min(MAX_ZOOM, viewport.zoom + 0.25),
    };
    setViewport(newVp);
    saveViewport(newVp);
  }, [viewport, saveViewport]);

  const zoomOut = useCallback(() => {
    const newVp = {
      ...viewport,
      zoom: Math.max(MIN_ZOOM, viewport.zoom - 0.25),
    };
    setViewport(newVp);
    saveViewport(newVp);
  }, [viewport, saveViewport]);

  const fitToView = useCallback(() => {
    if (items.length === 0) {
      const newVp = { x: 0, y: 0, zoom: 1 };
      setViewport(newVp);
      saveViewport(newVp);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const padding = 80;
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

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(rect.width / contentWidth, rect.height / contentHeight))
    );

    const newVp = {
      x: rect.width / 2 - (minX + (maxX - minX) / 2) * zoom,
      y: rect.height / 2 - (minY + (maxY - minY) / 2) * zoom,
      zoom,
    };
    setViewport(newVp);
    saveViewport(newVp);
  }, [items, saveViewport]);

  const handleNameChange = useCallback(
    (name: string) => {
      setCanvasName(name);
      saveCanvasName(name);
    },
    [saveCanvasName]
  );

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Only delete if not focused on an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        if (selectedItem) {
          handleRemoveItem(selectedItem);
        }
      }
      if (e.key === "Escape") {
        setSelectedItem(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem, handleRemoveItem]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-sm">Loading canvas...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <CanvasToolbar
        canvasId={canvasId}
        canvasName={canvasName}
        onNameChange={handleNameChange}
        onAddItem={addItem}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToView={fitToView}
        zoom={viewport.zoom}
        selectedItem={selectedItem}
        onDeleteSelected={() => selectedItem && handleRemoveItem(selectedItem)}
      />

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,hsl(var(--border)/0.3)_19px,hsl(var(--border)/0.3)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,hsl(var(--border)/0.3)_19px,hsl(var(--border)/0.3)_20px)]"
        style={{ cursor: panning ? "grabbing" : "grab" }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Transformed layer */}
        <div
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {/* SVG connections layer */}
          <CanvasConnections items={items} connections={connections} />

          {/* Canvas items */}
          {items.map((item) => (
            <CanvasItemCard
              key={item.id}
              item={item}
              selected={selectedItem === item.id}
              dragging={dragging?.itemId === item.id}
              onMouseDown={(e) => handleItemMouseDown(item.id, e)}
              onRemove={() => handleRemoveItem(item.id)}
              onContentChange={(content) =>
                handleUpdateItemContent(item.id, content)
              }
            />
          ))}
        </div>
      </div>

      {/* Minimap */}
      <CanvasMinimap
        items={items}
        viewport={viewport}
        containerRef={containerRef}
        onViewportChange={(vp) => {
          setViewport(vp);
          saveViewport(vp);
        }}
      />
    </div>
  );
}
