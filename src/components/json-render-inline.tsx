"use client";

import { useMemo } from "react";
import { Renderer, JSONUIProvider } from "@json-render/react";
import { registry } from "@/lib/json-render/registry";

interface JsonRenderInlineProps {
  spec: Record<string, unknown>;
  className?: string;
}

export function JsonRenderInline({ spec, className }: JsonRenderInlineProps) {
  const isValid = useMemo(() => {
    return spec && typeof spec === "object" && "root" in spec && "elements" in spec;
  }, [spec]);

  if (!isValid) return null;

  return (
    <div className={className}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <JSONUIProvider registry={registry as any} initialState={{}}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Renderer spec={spec as any} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}
