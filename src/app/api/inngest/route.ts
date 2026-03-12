import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processContextFunction } from "@/lib/inngest/functions/process-context";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processContextFunction],
});
