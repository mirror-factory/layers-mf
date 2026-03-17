import { createAdminClient } from "@/lib/supabase/server";

interface UsageParams {
  orgId: string;
  userId?: string;
  operation: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  creditsUsed?: number;
  metadata?: Record<string, unknown>;
}

/** Log an AI operation. Fire-and-forget — never blocks the request. */
export function logUsage(params: UsageParams): void {
  try {
    const db = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (db as any)
      .from("usage_logs")
      .insert({
        org_id: params.orgId,
        user_id: params.userId ?? null,
        operation: params.operation,
        model: params.model,
        input_tokens: params.inputTokens ?? 0,
        output_tokens: params.outputTokens ?? 0,
        cost_usd: params.costUsd ?? 0,
        credits_used: params.creditsUsed ?? 0,
        metadata: params.metadata ?? {},
      })
      .then();
  } catch {
    // Fire-and-forget — silently ignore errors
  }
}
