export interface OrgTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  priorityDocs: { filename: string; content: string }[];
  defaultSchedules: {
    name: string;
    description: string;
    schedule: string;
    action_type: string;
    target_service: string;
    payload: Record<string, unknown>;
  }[];
  suggestedIntegrations: string[];
  defaultPermissions: Record<string, { read: boolean; write: boolean }>;
}

export const ORG_TEMPLATES: OrgTemplate[] = [
  {
    id: "startup-3-person",
    name: "Small Team (3-5 people)",
    description:
      "Perfect for co-founders and small teams. Includes morning digests, task tracking, and meeting summaries.",
    icon: "\u{1F680}",
    priorityDocs: [
      {
        filename: "01-mission.md",
        content:
          "# Mission & Values\n\nDefine your mission, vision, and core values here.\n\n## Mission\n[What does your company do?]\n\n## Values\n- [Value 1]\n- [Value 2]\n- [Value 3]\n\n## What We Won't Compromise On\n- [Non-negotiable 1]\n- [Non-negotiable 2]",
      },
      {
        filename: "02-team.md",
        content:
          "# Team\n\n## [Name] \u2014 [Role]\n- Communication style: []\n- Working hours: []\n\n## [Name] \u2014 [Role]\n- Communication style: []\n- Working hours: []",
      },
      {
        filename: "03-priorities.md",
        content:
          "# Current Priorities\n\n## Active Projects (Priority Order)\n1. [Project 1] \u2014 Target: [date]\n2. [Project 2] \u2014 Target: [date]\n\n## Saying No To\n- [Thing to avoid]\n\n## Key Deadlines\n- [Deadline 1]: [date]",
      },
    ],
    defaultSchedules: [
      {
        name: "Morning Digest",
        description: "Daily summary at 7 AM weekdays",
        schedule: "0 7 * * 1-5",
        action_type: "digest",
        target_service: "discord",
        payload: { endpoint: "/api/cron/digest" },
      },
      {
        name: "Overdue Alerts",
        description: "Check for overdue items every 2 hours",
        schedule: "0 */2 * * *",
        action_type: "query",
        target_service: "discord",
        payload: { endpoint: "/api/cron/discord-alerts" },
      },
    ],
    suggestedIntegrations: ["linear", "granola", "notion"],
    defaultPermissions: {
      linear: { read: true, write: true },
      gmail: { read: true, write: false },
      notion: { read: true, write: false },
      granola: { read: true, write: false },
      drive: { read: true, write: false },
    },
  },
  {
    id: "agency",
    name: "Agency / Client Services",
    description:
      "For agencies managing multiple clients. Includes client tracking, project management, and email drafting.",
    icon: "\u{1F3E2}",
    priorityDocs: [
      {
        filename: "01-mission.md",
        content:
          "# Agency Mission\n\n## Mission\n[What does your agency do?]\n\n## Values\n- Client success first\n- Quality over speed\n- Transparent communication",
      },
      {
        filename: "02-team.md",
        content: "# Team\n\n[Add team members here]",
      },
      {
        filename: "03-priorities.md",
        content:
          "# Current Quarter\n\n## Active Clients\n1. [Client 1] \u2014 [Service tier]\n2. [Client 2] \u2014 [Service tier]\n\n## Pipeline\n- [Prospect 1]",
      },
      {
        filename: "04-clients.md",
        content:
          "# Client Rules\n\n- Client deadlines are non-negotiable\n- All external communications require partner approval\n- Client data is confidential",
      },
    ],
    defaultSchedules: [
      {
        name: "Morning Digest",
        description: "Daily summary at 7 AM weekdays",
        schedule: "0 7 * * 1-5",
        action_type: "digest",
        target_service: "discord",
        payload: { endpoint: "/api/cron/digest" },
      },
      {
        name: "Linear Status Check",
        description: "Task updates every 3 minutes",
        schedule: "*/3 * * * *",
        action_type: "sync",
        target_service: "linear",
        payload: { endpoint: "/api/cron/linear-check" },
      },
    ],
    suggestedIntegrations: ["linear", "gmail", "notion", "granola"],
    defaultPermissions: {
      linear: { read: true, write: true },
      gmail: { read: true, write: true },
      notion: { read: true, write: true },
      granola: { read: true, write: false },
      drive: { read: true, write: false },
    },
  },
  {
    id: "solo",
    name: "Solo Founder",
    description:
      "For individual founders who want an AI executive assistant. Streamlined with auto-approvals.",
    icon: "\u{1F464}",
    priorityDocs: [
      {
        filename: "01-mission.md",
        content:
          "# Mission\n\n[What are you building?]\n\n## Values\n- [Value 1]\n- [Value 2]",
      },
      {
        filename: "02-priorities.md",
        content:
          "# Priorities\n\n1. [Priority 1]\n2. [Priority 2]\n\n## This Week\n- [ ] [Task 1]\n- [ ] [Task 2]",
      },
    ],
    defaultSchedules: [
      {
        name: "Morning Digest",
        description: "Daily summary at 8 AM",
        schedule: "0 8 * * *",
        action_type: "digest",
        target_service: "discord",
        payload: { endpoint: "/api/cron/digest" },
      },
    ],
    suggestedIntegrations: ["linear", "notion"],
    defaultPermissions: {
      linear: { read: true, write: true },
      gmail: { read: true, write: true },
      notion: { read: true, write: true },
      granola: { read: true, write: true },
      drive: { read: true, write: true },
    },
  },
];

export function getTemplateById(id: string): OrgTemplate | undefined {
  return ORG_TEMPLATES.find((t) => t.id === id);
}
