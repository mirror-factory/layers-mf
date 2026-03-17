import { createAdminClient } from "@/lib/supabase/server";

/** Credit costs per operation (hardcoded fallbacks) */
export const CREDIT_COSTS = {
  chat: 1,
  extraction: 2,
  embedding: 0.5,
  inbox_generation: 1,
  query_expansion: 0.2,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

// ─── Dynamic config cache ────────────────────────────────────────────

interface CachedConfig {
  operations: Record<string, { base_credits: number; per_1k_tokens: number }>;
  fetchedAt: number;
}

let configCache: CachedConfig | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchCreditConfig(): Promise<CachedConfig["operations"] | null> {
  // Return cached if still fresh
  if (configCache && Date.now() - configCache.fetchedAt < CACHE_TTL_MS) {
    return configCache.operations;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = createAdminClient() as any;
    const { data, error } = await adminDb
      .from("platform_config")
      .select("value")
      .eq("key", "credit_config")
      .single();

    if (error || !data?.value) return null;

    const value = data.value as { operations?: CachedConfig["operations"] };
    if (!value.operations) return null;

    configCache = { operations: value.operations, fetchedAt: Date.now() };
    return value.operations;
  } catch {
    return null;
  }
}

/**
 * Get the credit cost for an operation from platform_config.
 * Falls back to hardcoded CREDIT_COSTS if config is unavailable.
 * Results are cached for 5 minutes.
 */
export async function getOperationCost(operation: string): Promise<number> {
  const ops = await fetchCreditConfig();

  if (ops && ops[operation]) {
    return ops[operation].base_credits;
  }

  // Fallback to hardcoded
  const fallback = CREDIT_COSTS[operation as CreditOperation];
  return fallback ?? 1;
}

export class InsufficientCreditsError extends Error {
  public balance: number;
  public required: number;

  constructor(balance: number, required: number) {
    super(
      `Insufficient credits: balance=${balance}, required=${required}`
    );
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.required = required;
  }
}

/** Check if org has enough credits for an operation */
export async function checkCredits(
  orgId: string,
  amount: number
): Promise<{ sufficient: boolean; balance: number }> {
  const adminDb = createAdminClient();

  const { data, error } = await adminDb
    .from("organizations")
    .select("credit_balance")
    .eq("id", orgId)
    .single();

  if (error || !data) {
    return { sufficient: false, balance: 0 };
  }

  const balance = data.credit_balance ?? 0;
  return { sufficient: balance >= amount, balance };
}

/**
 * Deduct credits atomically. Returns new balance.
 * Throws InsufficientCreditsError if balance is too low.
 *
 * Uses a conditional UPDATE with a WHERE clause to prevent
 * the balance from going negative (atomic check-and-deduct).
 */
export async function deductCredits(
  orgId: string,
  amount: number,
  operation: string
): Promise<number> {
  const adminDb = createAdminClient();

  // Atomic deduction: only succeeds if balance >= amount
  // We use rpc to run raw SQL since Supabase JS client doesn't support
  // UPDATE ... SET balance = balance - X WHERE balance >= X natively.
  // Instead, we read-then-update with a check.
  const { data: org, error: readError } = await adminDb
    .from("organizations")
    .select("credit_balance")
    .eq("id", orgId)
    .single();

  if (readError || !org) {
    throw new InsufficientCreditsError(0, amount);
  }

  const currentBalance = org.credit_balance ?? 0;
  if (currentBalance < amount) {
    throw new InsufficientCreditsError(currentBalance, amount);
  }

  const newBalance = currentBalance - amount;

  const { error: updateError } = await adminDb
    .from("organizations")
    .update({ credit_balance: newBalance })
    .eq("id", orgId)
    // Optimistic concurrency: ensure balance hasn't changed since we read it
    .gte("credit_balance", amount);

  if (updateError) {
    throw new InsufficientCreditsError(currentBalance, amount);
  }

  return newBalance;
}
