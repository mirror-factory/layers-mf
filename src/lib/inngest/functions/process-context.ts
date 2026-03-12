import { inngest } from "@/lib/inngest/client";

export const processContextFunction = inngest.createFunction(
  {
    id: "process-context-item",
    concurrency: { limit: 10 },
    retries: 3,
  },
  { event: "context/item.created" },
  async ({ event, step }) => {
    const { contextItemId, orgId } = event.data;

    // Placeholder — will be filled in Phase 2 with chunking pipeline
    return { contextItemId, orgId, status: "placeholder" };
  }
);
