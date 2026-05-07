"use client";

import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { catalog } from "./catalog";

/**
 * Granger's json-render registry.
 * Maps catalog component names to actual React components.
 */
export const { registry } = defineRegistry(catalog, {
  components: {
    ...shadcnComponents,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);
