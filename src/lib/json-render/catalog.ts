import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const catalog = defineCatalog(schema, {
  components: {
    ...shadcnComponentDefinitions,
  },
  actions: {},
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

export function getJsonRenderPrompt(): string {
  return catalog.prompt();
}
