import { createHmac, timingSafeEqual } from "crypto";
import { nango } from "@/lib/nango/client";

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

// ── Webhook Management via Nango Proxy ──────────────────────────────────────

const LINEAR_GRAPHQL_ENDPOINT = "/graphql";

/**
 * Execute a Linear GraphQL query/mutation through the Nango proxy.
 * This uses the user's OAuth token managed by Nango.
 */
async function linearGraphQL<T>(
  connectionId: string,
  provider: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await nango.proxy<{ data: T; errors?: { message: string }[] }>({
    method: "POST",
    providerConfigKey: provider,
    connectionId,
    endpoint: LINEAR_GRAPHQL_ENDPOINT,
    data: { query, variables },
  });

  if (res.data?.errors?.length) {
    throw new Error(
      `Linear GraphQL error: ${res.data.errors.map((e) => e.message).join(", ")}`
    );
  }

  return res.data.data;
}

/**
 * Create a Linear webhook subscription.
 * Returns the webhook ID and signing secret.
 */
export async function createLinearWebhook(
  connectionId: string,
  provider: string,
  webhookUrl: string,
  teamId?: string
): Promise<{ webhookId: string; secret: string }> {
  const mutation = `
    mutation CreateWebhook($input: WebhookCreateInput!) {
      webhookCreate(input: $input) {
        success
        webhook {
          id
          secret
        }
      }
    }
  `;

  const input: Record<string, unknown> = {
    url: webhookUrl,
    resourceTypes: ["Issue", "Comment", "Project", "Cycle"],
    enabled: true,
  };

  if (teamId) {
    input.teamId = teamId;
  }

  const data = await linearGraphQL<{
    webhookCreate: {
      success: boolean;
      webhook: { id: string; secret: string };
    };
  }>(connectionId, provider, mutation, { input });

  if (!data.webhookCreate.success) {
    throw new Error("Failed to create Linear webhook");
  }

  return {
    webhookId: data.webhookCreate.webhook.id,
    secret: data.webhookCreate.webhook.secret,
  };
}

/**
 * Delete a Linear webhook subscription.
 */
export async function deleteLinearWebhook(
  connectionId: string,
  provider: string,
  webhookId: string
): Promise<boolean> {
  const mutation = `
    mutation DeleteWebhook($id: String!) {
      webhookDelete(id: $id) {
        success
      }
    }
  `;

  const data = await linearGraphQL<{
    webhookDelete: { success: boolean };
  }>(connectionId, provider, mutation, { id: webhookId });

  return data.webhookDelete.success;
}

// ── GraphQL Sync Queries ────────────────────────────────────────────────────

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

const ISSUES_QUERY = `
  query Issues($first: Int!, $after: String, $filter: IssueFilter) {
    issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id identifier title description url
        state { name }
        assignee { name }
        priority
        labels { nodes { name } }
        team { name key }
        comments { nodes { id body user { name } createdAt updatedAt } }
        createdAt updatedAt
      }
    }
  }
`;

const PROJECTS_QUERY = `
  query Projects($first: Int!, $after: String, $filter: ProjectFilter) {
    projects(first: $first, after: $after, filter: $filter) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name description url state
        lead { name }
        members { nodes { name } }
        startDate targetDate progress
        createdAt updatedAt
      }
    }
  }
`;

const CYCLES_QUERY = `
  query Cycles($first: Int!, $after: String, $filter: CycleFilter) {
    cycles(first: $first, after: $after, filter: $filter) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id number name description
        startsAt endsAt completedAt progress
        team { name key }
        createdAt updatedAt
      }
    }
  }
`;

const ORGANIZATION_QUERY = `
  query Organization {
    organization {
      urlKey
    }
  }
`;

/**
 * Rate limit guard: Linear allows 1,500 req/hr.
 * We batch in pages of 50 and cap total pages to avoid bursting.
 */
const PAGE_SIZE = 50;
const MAX_PAGES = 10; // 50 * 10 = 500 items max per sync

export async function fetchLinearIssues(
  connectionId: string,
  provider: string,
  updatedAfter?: string
): Promise<LinearIssue[]> {
  const issues: LinearIssue[] = [];
  let after: string | undefined;

  const filter = updatedAfter ? { updatedAt: { gte: updatedAfter } } : undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await linearGraphQL<{
      issues: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        nodes: LinearIssue[];
      };
    }>(connectionId, provider, ISSUES_QUERY, {
      first: PAGE_SIZE,
      after,
      filter,
    });

    issues.push(...data.issues.nodes);

    if (!data.issues.pageInfo.hasNextPage) break;
    after = data.issues.pageInfo.endCursor;
  }

  return issues;
}

export async function fetchLinearProjects(
  connectionId: string,
  provider: string,
  updatedAfter?: string
): Promise<LinearProject[]> {
  const projects: LinearProject[] = [];
  let after: string | undefined;

  const filter = updatedAfter ? { updatedAt: { gte: updatedAfter } } : undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await linearGraphQL<{
      projects: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        nodes: LinearProject[];
      };
    }>(connectionId, provider, PROJECTS_QUERY, {
      first: PAGE_SIZE,
      after,
      filter,
    });

    projects.push(...data.projects.nodes);

    if (!data.projects.pageInfo.hasNextPage) break;
    after = data.projects.pageInfo.endCursor;
  }

  return projects;
}

export async function fetchLinearCycles(
  connectionId: string,
  provider: string,
  updatedAfter?: string
): Promise<LinearCycle[]> {
  const cycles: LinearCycle[] = [];
  let after: string | undefined;

  const filter = updatedAfter ? { updatedAt: { gte: updatedAfter } } : undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await linearGraphQL<{
      cycles: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        nodes: LinearCycle[];
      };
    }>(connectionId, provider, CYCLES_QUERY, {
      first: PAGE_SIZE,
      after,
      filter,
    });

    cycles.push(...data.cycles.nodes);

    if (!data.cycles.pageInfo.hasNextPage) break;
    after = data.cycles.pageInfo.endCursor;
  }

  return cycles;
}

export async function fetchLinearOrgSlug(
  connectionId: string,
  provider: string
): Promise<string | undefined> {
  try {
    const data = await linearGraphQL<{
      organization: { urlKey: string };
    }>(connectionId, provider, ORGANIZATION_QUERY);
    return data.organization.urlKey;
  } catch {
    return undefined;
  }
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
