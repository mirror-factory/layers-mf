export type McpHealthStatus = "unknown" | "healthy" | "degraded" | "down" | "reauth_required";

export type McpToolSnapshot = {
  name: string;
  lastSeenAt?: string;
};

export function snapshotMcpTools(toolNames: string[], checkedAt = new Date().toISOString()): McpToolSnapshot[] {
  return [...new Set(toolNames)]
    .filter(Boolean)
    .sort()
    .map((name) => ({ name, lastSeenAt: checkedAt }));
}

export function nextMcpReconnectAfter(failureCount: number, now = Date.now()) {
  const failures = Math.max(failureCount, 1);
  const delayMinutes = Math.min(60, 2 ** Math.min(failures - 1, 6));
  return new Date(now + delayMinutes * 60_000).toISOString();
}

export function classifyMcpHealth(input: {
  success: boolean;
  requiresOAuth?: boolean;
  toolCount?: number;
}): McpHealthStatus {
  if (input.success) return input.toolCount === 0 ? "degraded" : "healthy";
  if (input.requiresOAuth) return "reauth_required";
  return "down";
}
