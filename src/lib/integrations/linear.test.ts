import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNangoProxy } = vi.hoisted(() => ({
  mockNangoProxy: vi.fn(),
}));

vi.mock("@/lib/nango/client", () => ({
  nango: { proxy: mockNangoProxy },
}));

import {
  verifyLinearSignature,
  priorityLabel,
  buildLinearUrl,
  buildIssueContent,
  buildIssueMetadata,
  buildCommentContent,
  buildProjectContent,
  buildCycleContent,
  fetchLinearIssues,
  fetchLinearProjects,
  fetchLinearCycles,
  fetchLinearOrgSlug,
  type LinearIssue,
  type LinearComment,
  type LinearProject,
  type LinearCycle,
} from "./linear";
import { createHmac } from "crypto";

// ── verifyLinearSignature ────────────────────────────────────────────────────

describe("verifyLinearSignature", () => {
  const secret = "test-secret";

  it("returns true for a valid HMAC-SHA256 signature", () => {
    const body = '{"action":"create"}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyLinearSignature(body, sig, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const body = '{"action":"create"}';
    const sig = "0".repeat(64);
    expect(verifyLinearSignature(body, sig, secret)).toBe(false);
  });

  it("returns false when body is empty", () => {
    expect(verifyLinearSignature("", "abc", secret)).toBe(false);
  });

  it("returns false when signature is empty", () => {
    expect(verifyLinearSignature("body", "", secret)).toBe(false);
  });

  it("returns false when secret is empty", () => {
    expect(verifyLinearSignature("body", "abc", "")).toBe(false);
  });

  it("returns false for non-hex signature", () => {
    expect(verifyLinearSignature("body", "not-hex!", secret)).toBe(false);
  });
});

// ── priorityLabel ────────────────────────────────────────────────────────────

describe("priorityLabel", () => {
  it("returns 'Urgent' for priority 1", () => {
    expect(priorityLabel(1)).toBe("Urgent");
  });

  it("returns 'High' for priority 2", () => {
    expect(priorityLabel(2)).toBe("High");
  });

  it("returns 'Medium' for priority 3", () => {
    expect(priorityLabel(3)).toBe("Medium");
  });

  it("returns 'Low' for priority 4", () => {
    expect(priorityLabel(4)).toBe("Low");
  });

  it("returns 'No Priority' for priority 0", () => {
    expect(priorityLabel(0)).toBe("No Priority");
  });

  it("returns 'No Priority' for null", () => {
    expect(priorityLabel(null)).toBe("No Priority");
  });

  it("returns 'No Priority' for undefined", () => {
    expect(priorityLabel(undefined)).toBe("No Priority");
  });

  it("returns string value for unknown priority number", () => {
    expect(priorityLabel(99)).toBe("99");
  });
});

// ── buildLinearUrl ───────────────────────────────────────────────────────────

describe("buildLinearUrl", () => {
  it("builds issue URL with org slug", () => {
    expect(buildLinearUrl("my-team", "issue", "ENG-42")).toBe(
      "https://linear.app/my-team/issue/ENG-42"
    );
  });

  it("builds project URL", () => {
    expect(buildLinearUrl("my-team", "project", "proj-1")).toBe(
      "https://linear.app/my-team/project/proj-1"
    );
  });

  it("builds cycle URL", () => {
    expect(buildLinearUrl("my-team", "cycle", "cycle-1")).toBe(
      "https://linear.app/my-team/cycle/cycle-1"
    );
  });

  it("defaults to 'workspace' when slug is undefined", () => {
    expect(buildLinearUrl(undefined, "issue", "ENG-1")).toBe(
      "https://linear.app/workspace/issue/ENG-1"
    );
  });
});

// ── buildIssueContent ────────────────────────────────────────────────────────

describe("buildIssueContent", () => {
  const baseIssue: LinearIssue = {
    id: "i-1",
    identifier: "ENG-42",
    title: "Fix bug",
    description: "Description of the bug",
    url: "https://linear.app/test/issue/ENG-42",
    state: { name: "In Progress" },
    assignee: { name: "Alice" },
    priority: 1,
    labels: { nodes: [{ name: "bug" }, { name: "critical" }] },
    team: { name: "Engineering", key: "ENG" },
    comments: { nodes: [] },
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
  };

  it("includes description and metadata", () => {
    const content = buildIssueContent(baseIssue);
    expect(content).toContain("Description of the bug");
    expect(content).toContain("ID: ENG-42");
    expect(content).toContain("Status: In Progress");
    expect(content).toContain("Assignee: Alice");
    expect(content).toContain("Priority: Urgent");
    expect(content).toContain("Labels: bug, critical");
    expect(content).toContain("Team: Engineering");
  });

  it("handles null state and assignee", () => {
    const issue = { ...baseIssue, state: null, assignee: null };
    const content = buildIssueContent(issue);
    expect(content).not.toContain("Status:");
    expect(content).not.toContain("Assignee:");
  });

  it("handles null description", () => {
    const issue = { ...baseIssue, description: null };
    const content = buildIssueContent(issue);
    expect(content).toContain("ID: ENG-42");
  });

  it("truncates content to 12000 characters", () => {
    const issue = { ...baseIssue, description: "A".repeat(15000) };
    const content = buildIssueContent(issue);
    expect(content.length).toBeLessThanOrEqual(12000);
  });
});

// ── buildIssueMetadata ───────────────────────────────────────────────────────

describe("buildIssueMetadata", () => {
  it("returns structured metadata object", () => {
    const issue: LinearIssue = {
      id: "i-1",
      identifier: "ENG-42",
      title: "Fix bug",
      description: "desc",
      url: "https://linear.app/test/issue/ENG-42",
      state: { name: "Done" },
      assignee: { name: "Bob" },
      priority: 2,
      labels: { nodes: [{ name: "feature" }] },
      team: { name: "Product", key: "PROD" },
      comments: { nodes: [] },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-02",
    };
    const meta = buildIssueMetadata(issue);
    expect(meta.url).toBe("https://linear.app/test/issue/ENG-42");
    expect(meta.identifier).toBe("ENG-42");
    expect(meta.state).toBe("Done");
    expect(meta.priority).toBe("High");
    expect(meta.assignee).toBe("Bob");
    expect(meta.labels).toEqual(["feature"]);
    expect(meta.team).toBe("Product");
  });

  it("returns null for missing optional fields", () => {
    const issue: LinearIssue = {
      id: "i-2",
      identifier: "",
      title: "No details",
      description: null,
      url: "",
      state: null,
      assignee: null,
      priority: 0,
      labels: { nodes: [] },
      team: null,
      comments: { nodes: [] },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    const meta = buildIssueMetadata(issue);
    expect(meta.state).toBeNull();
    expect(meta.assignee).toBeNull();
    expect(meta.team).toBeNull();
    expect(meta.labels).toEqual([]);
  });
});

// ── buildCommentContent ──────────────────────────────────────────────────────

describe("buildCommentContent", () => {
  it("builds comment content with issue context", () => {
    const comment: LinearComment = {
      id: "c-1",
      body: "This needs more work",
      user: { name: "Carol" },
      issue: { id: "i-1", identifier: "ENG-42", title: "Fix bug" },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-02",
    };
    const content = buildCommentContent(comment, "Fix bug", "ENG-42");
    expect(content).toContain("Comment on ENG-42: Fix bug");
    expect(content).toContain("Author: Carol");
    expect(content).toContain("This needs more work");
  });

  it("omits issue context when not provided", () => {
    const comment: LinearComment = {
      id: "c-2",
      body: "Standalone comment",
      user: null,
      issue: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    const content = buildCommentContent(comment);
    expect(content).not.toContain("Comment on");
    expect(content).toContain("Standalone comment");
  });
});

// ── buildProjectContent ──────────────────────────────────────────────────────

describe("buildProjectContent", () => {
  it("builds project content with metadata", () => {
    const project: LinearProject = {
      id: "p-1",
      name: "Q1 Roadmap",
      description: "Quarterly goals",
      url: "https://linear.app/test/project/p-1",
      state: "started",
      lead: { name: "Dan" },
      members: { nodes: [{ name: "Alice" }, { name: "Bob" }] },
      startDate: "2026-01-01",
      targetDate: "2026-03-31",
      progress: 0.75,
      createdAt: "2026-01-01",
      updatedAt: "2026-03-01",
    };
    const content = buildProjectContent(project);
    expect(content).toContain("Quarterly goals");
    expect(content).toContain("State: started");
    expect(content).toContain("Lead: Dan");
    expect(content).toContain("Members: Alice, Bob");
    expect(content).toContain("Progress: 75%");
    expect(content).toContain("Start: 2026-01-01");
    expect(content).toContain("Target: 2026-03-31");
  });
});

// ── buildCycleContent ────────────────────────────────────────────────────────

describe("buildCycleContent", () => {
  it("builds cycle content with metadata", () => {
    const cycle: LinearCycle = {
      id: "cy-1",
      number: 5,
      name: "Sprint 5",
      description: "Auth improvements",
      startsAt: "2026-03-01",
      endsAt: "2026-03-14",
      completedAt: null,
      progress: 0.4,
      team: { name: "Engineering", key: "ENG" },
      createdAt: "2026-03-01",
      updatedAt: "2026-03-07",
    };
    const content = buildCycleContent(cycle);
    expect(content).toContain("Auth improvements");
    expect(content).toContain("Cycle #5");
    expect(content).toContain("Team: Engineering");
    expect(content).toContain("Progress: 40%");
    expect(content).toContain("Starts: 2026-03-01");
    expect(content).toContain("Ends: 2026-03-14");
  });

  it("includes completedAt when present", () => {
    const cycle: LinearCycle = {
      id: "cy-2",
      number: 4,
      name: null,
      description: null,
      startsAt: "2026-02-15",
      endsAt: "2026-02-28",
      completedAt: "2026-02-27",
      progress: 1.0,
      team: null,
      createdAt: "2026-02-15",
      updatedAt: "2026-02-27",
    };
    const content = buildCycleContent(cycle);
    expect(content).toContain("Completed: 2026-02-27");
    expect(content).toContain("Progress: 100%");
  });
});

// ── fetchLinearIssues ────────────────────────────────────────────────────────

describe("fetchLinearIssues", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches issues via GraphQL through Nango proxy", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        data: {
          issues: {
            pageInfo: { hasNextPage: false, endCursor: "" },
            nodes: [
              {
                id: "i-1",
                identifier: "ENG-1",
                title: "Issue 1",
                description: "Desc",
                url: "",
                state: { name: "Todo" },
                assignee: null,
                priority: 3,
                labels: { nodes: [] },
                team: null,
                comments: { nodes: [] },
                createdAt: "2026-01-01",
                updatedAt: "2026-01-02",
              },
            ],
          },
        },
      },
    });

    const issues = await fetchLinearIssues("conn-1", "linear");
    expect(issues).toHaveLength(1);
    expect(issues[0].identifier).toBe("ENG-1");
  });

  it("paginates through multiple pages", async () => {
    mockNangoProxy
      .mockResolvedValueOnce({
        data: {
          data: {
            issues: {
              pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
              nodes: [{ id: "i-1", identifier: "A-1", title: "T", description: null, url: "", state: null, assignee: null, priority: 0, labels: { nodes: [] }, team: null, comments: { nodes: [] }, createdAt: "", updatedAt: "" }],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            issues: {
              pageInfo: { hasNextPage: false, endCursor: "" },
              nodes: [{ id: "i-2", identifier: "A-2", title: "T2", description: null, url: "", state: null, assignee: null, priority: 0, labels: { nodes: [] }, team: null, comments: { nodes: [] }, createdAt: "", updatedAt: "" }],
            },
          },
        },
      });

    const issues = await fetchLinearIssues("conn-1", "linear");
    expect(issues).toHaveLength(2);
    expect(mockNangoProxy).toHaveBeenCalledTimes(2);
  });

  it("passes updatedAfter filter when provided", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        data: {
          issues: {
            pageInfo: { hasNextPage: false, endCursor: "" },
            nodes: [],
          },
        },
      },
    });

    await fetchLinearIssues("conn-1", "linear", "2026-03-01");
    expect(mockNangoProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variables: expect.objectContaining({
            filter: { updatedAt: { gte: "2026-03-01" } },
          }),
        }),
      })
    );
  });
});

// ── fetchLinearProjects ──────────────────────────────────────────────────────

describe("fetchLinearProjects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches projects via GraphQL", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        data: {
          projects: {
            pageInfo: { hasNextPage: false, endCursor: "" },
            nodes: [
              {
                id: "p-1",
                name: "Project 1",
                description: "Desc",
                url: "",
                state: "planned",
                lead: null,
                members: { nodes: [] },
                startDate: null,
                targetDate: null,
                progress: 0,
                createdAt: "2026-01-01",
                updatedAt: "2026-01-02",
              },
            ],
          },
        },
      },
    });

    const projects = await fetchLinearProjects("conn-1", "linear");
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Project 1");
  });
});

// ── fetchLinearCycles ────────────────────────────────────────────────────────

describe("fetchLinearCycles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches cycles via GraphQL", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: {
        data: {
          cycles: {
            pageInfo: { hasNextPage: false, endCursor: "" },
            nodes: [
              {
                id: "cy-1",
                number: 1,
                name: "Sprint 1",
                description: null,
                startsAt: "2026-01-01",
                endsAt: "2026-01-14",
                completedAt: null,
                progress: 0,
                team: { name: "Eng", key: "ENG" },
                createdAt: "2026-01-01",
                updatedAt: "2026-01-07",
              },
            ],
          },
        },
      },
    });

    const cycles = await fetchLinearCycles("conn-1", "linear");
    expect(cycles).toHaveLength(1);
    expect(cycles[0].name).toBe("Sprint 1");
  });
});

// ── fetchLinearOrgSlug ───────────────────────────────────────────────────────

describe("fetchLinearOrgSlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns org URL key", async () => {
    mockNangoProxy.mockResolvedValueOnce({
      data: { data: { organization: { urlKey: "my-team" } } },
    });

    const slug = await fetchLinearOrgSlug("conn-1", "linear");
    expect(slug).toBe("my-team");
  });

  it("returns undefined on error", async () => {
    mockNangoProxy.mockRejectedValueOnce(new Error("API error"));
    const slug = await fetchLinearOrgSlug("conn-1", "linear");
    expect(slug).toBeUndefined();
  });
});
