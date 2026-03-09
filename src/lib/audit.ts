import type { SupabaseClient } from "@supabase/supabase-js";

interface AuditEntry {
  orgId: string;
  userId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export function logAudit(
  supabase: SupabaseClient,
  { orgId, userId, action, resourceType, resourceId, metadata }: AuditEntry
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any)
    .from("audit_log")
    .insert({
      org_id: orgId,
      user_id: userId ?? null,
      action,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      metadata: metadata ?? {},
    })
    .then();
}
