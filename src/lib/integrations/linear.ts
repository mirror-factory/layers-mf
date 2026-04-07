import { createHmac, timingSafeEqual } from "crypto";

// ── HMAC Signature Verification ─────────────────────────────────────────────

/**
 * Verify Linear webhook HMAC-SHA256 signature.
 * Linear sends the signature as a hex-encoded HMAC of the raw body.
 */
export function verifyLinearSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!body || !signature || !secret) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ── Linear Priority Labels ──────────────────────────────────────────────────

const PRIORITY_LABELS: Record<number, string> = {
  0: "No Priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

export function priorityLabel(priority: number | undefined | null): string {
  if (priority == null) return "No Priority";
  return PRIORITY_LABELS[priority] ?? String(priority);
}

// ── Linear URL Builder ──────────────────────────────────────────────────────

/**
 * Build a deep link URL for a Linear entity.
 * Linear URLs follow the pattern: https://linear.app/{workspace}/issue/{identifier}
 */
export function buildLinearUrl(
  orgSlug: string | undefined,
  type: "issue" | "project" | "cycle",
  identifier: string
): string {
  const workspace = orgSlug ?? "workspace";
  switch (type) {
    case "issue":
      return `https://linear.app/${workspace}/issue/${identifier}`;
    case "project":
      return `https://linear.app/${workspace}/project/${identifier}`;
    case "cycle":
      return `https://linear.app/${workspace}/cycle/${identifier}`;
  }
}

// ── Types (used by webhook handler) ─────────────────────────────────────────

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  state: { name: string } | null;
  assignee: { name: string } | null;
  priority: number;
  labels: { nodes: { name: string }[] };
  team: { name: string; key: string } | null;
  comments: { nodes: LinearComment[] };
  createdAt: string;
  updatedAt: string;
}

export interface LinearComment {
  id: string;
  body: string;
  user: { name: string } | null;
  issue: { id: string; identifier: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description: string | null;
  url: string;
  state: string;
  lead: { name: string } | null;
  members: { nodes: { name: string }[] };
  startDate: string | null;
  targetDate: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinearCycle {
  id: string;
  number: number;
  name: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  progress: number;
  team: { name: string; key: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ── Content builders for context_items ──────────────────────────────────────

export function buildIssueContent(issue: LinearIssue): string {
  const meta: string[] = [];
  if (issue.identifier) meta.push(`ID: ${issue.identifier}`);
  if (issue.state?.name) meta.push(`Status: ${issue.state.name}`);
  if (issue.assignee?.name) meta.push(`Assignee: ${issue.assignee.name}`);
  meta.push(`Priority: ${priorityLabel(issue.priority)}`);
  const labels = issue.labels?.nodes?.map((l) => l.name) ?? [];
  if (labels.length > 0) meta.push(`Labels: ${labels.join(", ")}`);
  if (issue.team?.name) meta.push(`Team: ${issue.team.name}`);

  const description = issue.description ?? "";
  const metaBlock = meta.length > 0 ? `\n\n${meta.join(" | ")}` : "";
  return (description + metaBlock).slice(0, 12000);
}

export function buildIssueMetadata(issue: LinearIssue) {
  return {
    url: issue.url,
    identifier: issue.identifier,
    state: issue.state?.name ?? null,
    priority: priorityLabel(issue.priority),
    assignee: issue.assignee?.name ?? null,
    labels: issue.labels?.nodes?.map((l) => l.name) ?? [],
    team: issue.team?.name ?? null,
  };
}

export function buildCommentContent(
  comment: LinearComment,
  issueTitle?: string,
  issueIdentifier?: string
): string {
  const parts: string[] = [];
  if (issueIdentifier && issueTitle) {
    parts.push(`Comment on ${issueIdentifier}: ${issueTitle}`);
  }
  if (comment.user?.name) {
    parts.push(`Author: ${comment.user.name}`);
  }
  parts.push(`Date: ${comment.createdAt}`);
  parts.push("");
  parts.push(comment.body);
  return parts.join("\n").slice(0, 12000);
}

export function buildProjectContent(project: LinearProject): string {
  const parts: string[] = [];
  parts.push(project.description ?? "");
  parts.push("");

  const meta: string[] = [];
  meta.push(`State: ${project.state}`);
  if (project.lead?.name) meta.push(`Lead: ${project.lead.name}`);
  const memberNames = project.members?.nodes?.map((m) => m.name) ?? [];
  if (memberNames.length > 0) meta.push(`Members: ${memberNames.join(", ")}`);
  meta.push(`Progress: ${Math.round(project.progress * 100)}%`);
  if (project.startDate) meta.push(`Start: ${project.startDate}`);
  if (project.targetDate) meta.push(`Target: ${project.targetDate}`);

  parts.push(meta.join(" | "));
  return parts.join("\n").slice(0, 12000);
}

export function buildCycleContent(cycle: LinearCycle): string {
  const parts: string[] = [];
  if (cycle.description) parts.push(cycle.description);
  parts.push("");

  const meta: string[] = [];
  meta.push(`Cycle #${cycle.number}`);
  if (cycle.team?.name) meta.push(`Team: ${cycle.team.name}`);
  meta.push(`Progress: ${Math.round(cycle.progress * 100)}%`);
  meta.push(`Starts: ${cycle.startsAt}`);
  meta.push(`Ends: ${cycle.endsAt}`);
  if (cycle.completedAt) meta.push(`Completed: ${cycle.completedAt}`);

  parts.push(meta.join(" | "));
  return parts.join("\n").slice(0, 12000);
}
