import { LinearClient as SDKClient, LinearDocument } from '@linear/sdk';
import type { IngestableRecord, ProviderClient } from './types';

export interface LinearIssueResult {
  id: string;
  identifier: string; // e.g. "COMP-27"
  title: string;
  description: string | null;
  state: { name: string } | null;
  assignee: { name: string; email: string } | null;
  priority: number; // 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
  dueDate: string | null;
  url: string;
  team: { name: string; key: string } | null;
  labels: { name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface LinearIssueFilter {
  state?: string; // 'started' | 'unstarted' | 'completed' | 'canceled'
  assignee?: string; // user name or email
  team?: string; // team key
  priority?: number; // 1-4
  limit?: number;
}

export interface LinearCreateInput {
  title: string;
  teamId: string;
  description?: string;
  priority?: number;
  assigneeId?: string;
  dueDate?: string;
}

export class LinearApiClient implements ProviderClient {
  readonly provider = 'linear';
  private client: SDKClient;

  constructor(apiKey: string) {
    this.client = new SDKClient({ apiKey });
  }

  /** List issues with optional filters */
  async listIssues(filter?: LinearIssueFilter): Promise<LinearIssueResult[]> {
    const limit = filter?.limit ?? 50;

    // Build filter object for Linear SDK
    const issueFilter: Record<string, unknown> = {};
    if (filter?.state) {
      issueFilter.state = { name: { eq: filter.state } };
    }
    if (filter?.assignee) {
      issueFilter.assignee = {
        or: [
          { name: { containsIgnoreCase: filter.assignee } },
          { email: { containsIgnoreCase: filter.assignee } },
        ],
      };
    }
    if (filter?.team) {
      issueFilter.team = { key: { eq: filter.team } };
    }
    if (filter?.priority) {
      issueFilter.priority = { eq: filter.priority };
    }

    const issues = await this.client.issues({
      first: limit,
      filter: Object.keys(issueFilter).length > 0 ? issueFilter : undefined,
      orderBy: LinearDocument.PaginationOrderBy.UpdatedAt,
    });

    const results: LinearIssueResult[] = [];
    for (const issue of issues.nodes) {
      const [state, assignee, team, labels] = await Promise.all([
        issue.state,
        issue.assignee,
        issue.team,
        issue.labels(),
      ]);

      results.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? null,
        state: state ? { name: state.name } : null,
        assignee: assignee ? { name: assignee.name, email: assignee.email } : null,
        priority: issue.priority,
        dueDate: issue.dueDate ?? null,
        url: issue.url,
        team: team ? { name: team.name, key: team.key } : null,
        labels: (labels?.nodes ?? []).map(l => ({ name: l.name })),
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
      });
    }

    return results;
  }

  /** Get a single issue by ID */
  async getIssue(id: string): Promise<LinearIssueResult | null> {
    try {
      const issue = await this.client.issue(id);
      const [state, assignee, team, labels] = await Promise.all([
        issue.state,
        issue.assignee,
        issue.team,
        issue.labels(),
      ]);

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? null,
        state: state ? { name: state.name } : null,
        assignee: assignee ? { name: assignee.name, email: assignee.email } : null,
        priority: issue.priority,
        dueDate: issue.dueDate ?? null,
        url: issue.url,
        team: team ? { name: team.name, key: team.key } : null,
        labels: (labels?.nodes ?? []).map(l => ({ name: l.name })),
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  /** Create a new issue */
  async createIssue(input: LinearCreateInput): Promise<{ id: string; identifier: string; url: string }> {
    const result = await this.client.createIssue({
      title: input.title,
      teamId: input.teamId,
      description: input.description,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
    });

    const issue = await result.issue;
    if (!issue) throw new Error('Failed to create Linear issue');

    return {
      id: issue.id,
      identifier: issue.identifier,
      url: issue.url,
    };
  }

  /** Update an existing issue */
  async updateIssue(id: string, updates: {
    title?: string;
    description?: string;
    priority?: number;
    stateId?: string;
    assigneeId?: string;
    dueDate?: string;
  }): Promise<{ success: boolean }> {
    const result = await this.client.updateIssue(id, updates);
    return { success: result.success };
  }

  /** Get teams (needed for createIssue) */
  async listTeams(): Promise<{ id: string; name: string; key: string }[]> {
    const teams = await this.client.teams();
    return teams.nodes.map(t => ({
      id: t.id,
      name: t.name,
      key: t.key,
    }));
  }

  /** ProviderClient interface: list issues as IngestableRecords */
  async list(options?: { since?: string; limit?: number }): Promise<IngestableRecord[]> {
    const issues = await this.listIssues({ limit: options?.limit ?? 30 });

    return issues
      .filter(i => (i.description?.length ?? 0) >= 10)
      .map(issue => {
        const meta: string[] = [];
        if (issue.identifier) meta.push(`ID: ${issue.identifier}`);
        if (issue.state?.name) meta.push(`Status: ${issue.state.name}`);
        if (issue.assignee?.name) meta.push(`Assignee: ${issue.assignee.name}`);
        const priorityLabels = ['None', 'Urgent', 'High', 'Medium', 'Low'];
        meta.push(`Priority: ${priorityLabels[issue.priority] ?? issue.priority}`);
        if (issue.labels.length > 0) meta.push(`Labels: ${issue.labels.map(l => l.name).join(', ')}`);

        const metaBlock = meta.length > 0 ? `\n\n${meta.join(' | ')}` : '';
        const content = ((issue.description ?? '') + metaBlock).slice(0, 12000);

        return {
          source_id: issue.id,
          source_type: 'linear',
          content_type: 'issue' as const,
          title: issue.identifier ? `${issue.identifier}: ${issue.title}` : issue.title,
          raw_content: content,
          source_created_at: issue.createdAt,
          source_metadata: {
            identifier: issue.identifier,
            state: issue.state?.name,
            assignee: issue.assignee?.name,
            priority: issue.priority,
            team: issue.team?.key,
            url: issue.url,
          },
        };
      });
  }

  /** ProviderClient interface: get single issue as IngestableRecord */
  async get(id: string): Promise<IngestableRecord | null> {
    const issue = await this.getIssue(id);
    if (!issue || (issue.description?.length ?? 0) < 10) return null;

    return {
      source_id: issue.id,
      source_type: 'linear',
      content_type: 'issue',
      title: issue.identifier ? `${issue.identifier}: ${issue.title}` : issue.title,
      raw_content: (issue.description ?? '').slice(0, 12000),
      source_created_at: issue.createdAt,
    };
  }
}
