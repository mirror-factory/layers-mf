import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processContextFunction } from "@/lib/inngest/functions/process-context";
import { sessionAgentFunction } from "@/lib/inngest/functions/session-agent";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processContextFunction, sessionAgentFunction],
});
