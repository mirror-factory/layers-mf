/**
 * Manually annotated expected extraction outputs for each transcript (PROD-133).
 * Used as ground truth for scoring the extraction pipeline.
 */

export interface ExpectedExtraction {
  id: string;
  action_items: string[];
  decisions: string[];
  people: string[];
  topics: string[];
}

export const EXPECTED_EXTRACTIONS: ExpectedExtraction[] = [
  {
    id: "sprint-planning-01",
    action_items: [
      "David set up pgvector extension by Wednesday",
      "David update API documentation by end of sprint",
      "Priya build onboarding flow prototype by Friday",
      "Lisa finalize mobile responsive designs by Tuesday",
      "Marcus remove legacy CSV export endpoints and frontend code",
    ],
    decisions: [
      "Drop the legacy CSV export feature",
      "Use URL-based versioning with /v1/ prefix for the API",
    ],
    people: ["Sarah Chen", "Marcus Rivera", "Priya Patel", "David Kim", "Lisa Zhang"],
    topics: ["search relevance", "pgvector", "onboarding flow", "CSV export", "API versioning"],
  },
  {
    id: "product-review-02",
    action_items: [
      "Wei build materialized view for adoption metrics",
      "Wei set up Clickhouse connection for raw event stream",
      "Rachel send event taxonomy document by Thursday",
      "Sarah update spec with rolling averages",
      "Sarah schedule follow-up meeting in two weeks",
    ],
    decisions: [
      "Analytics dashboard ships behind a feature flag, Pro tier only initially",
      "Use rolling averages as the default view",
    ],
    people: ["James Walker", "Sarah Chen", "Wei Liu", "Rachel Green"],
    topics: ["analytics dashboard", "KPIs", "daily active users", "feature adoption", "rolling averages", "feature flag"],
  },
  {
    id: "retro-03",
    action_items: [
      "David create tracking issue for Zod validation and start with auth and payment endpoints by next Friday",
      "Alex set up GitHub CODEOWNERS file and review rotation by Monday",
      "Nina evaluate Sentry vs LogRocket and present recommendation at next standup",
    ],
    decisions: [
      "4-hour SLA for code reviews",
      "Add Zod schemas to all public API endpoints",
    ],
    people: ["Marcus Rivera", "Priya Patel", "David Kim", "Alex Thompson", "Nina Kowalski"],
    topics: ["retrospective", "production incidents", "input validation", "code review", "error monitoring"],
  },
  {
    id: "sales-sync-04",
    action_items: [
      "Tom talk to legal and push for 48-hour BAA turnaround",
      "Katie draft job description for webinar SDR role by Monday",
      "Jennifer send technical requirements for Meridian custom SSO integration",
      "Tom set up call with engineering about SSO by end of week",
      "Tom raise SOC 2 at leadership meeting next Tuesday",
    ],
    decisions: [
      "Trial a dedicated webinar SDR role",
    ],
    people: ["Tom Bradley", "Jennifer Liu", "Ryan O'Brien", "Katie Martinez"],
    topics: ["Q1 targets", "pipeline", "BAA", "webinar leads", "SSO integration", "SOC 2 compliance"],
  },
  {
    id: "design-review-05",
    action_items: [
      "Lisa update design system with new navigation components by Thursday",
      "Priya create shared navigation component library for web and mobile",
      "Omar set up React Native navigation structure by Wednesday",
      "Omar coordinate with David on deep linking changes",
    ],
    decisions: [
      "Use bottom tab bar navigation (Option A)",
      "Move Settings and Help into a profile/more menu",
    ],
    people: ["Lisa Zhang", "Sarah Chen", "Priya Patel", "Omar Hassan"],
    topics: ["mobile redesign", "navigation", "bottom tab bar", "design system", "React Native"],
  },
  {
    id: "executive-strategy-06",
    action_items: [
      "Elena start recruiting process for two ML engineers immediately",
      "Elena engage SOC 2 audit firm by mid-March",
      "Amy allocate SOC 2 audit budget from compliance budget",
      "Tom build updated pricing and sales materials by March 15",
    ],
    decisions: [
      "Approve two ML engineering hires",
      "Prioritize SOC 2 certification",
      "Set AI tier pricing at $20/seat/month add-on",
    ],
    people: ["Michael Torres", "James Walker", "Elena Vasquez", "Tom Bradley", "Amy Chen"],
    topics: ["Q2 planning", "AI search", "ML engineers", "SOC 2", "pricing", "enterprise"],
  },
  {
    id: "customer-success-07",
    action_items: [
      "Kevin schedule exit interviews with all four churned accounts by end of week",
      "Michelle draft automated check-in email sequences and share with marketing by Wednesday",
      "Michelle update CS playbook with new health score thresholds",
    ],
    decisions: [
      "Health score thresholds: below 40 is at-risk, 40-70 is monitor, above 70 is healthy",
      "Implement mandatory 30-day business reviews for all at-risk accounts",
    ],
    people: ["Hannah Park", "Michelle Torres", "Kevin Wright", "Sarah Chen"],
    topics: ["churn analysis", "onboarding", "health score", "customer success", "email automation"],
  },
  {
    id: "infrastructure-08",
    action_items: [
      "Alex set up PgBouncer by Friday",
      "Alex implement point-in-time recovery with continuous WAL archiving",
      "Nina create database migration plan and have it reviewed by next Wednesday",
      "David update application code to route read queries to replicas by March 15",
    ],
    decisions: [
      "Use read replicas over Aurora or Citus",
      "PgBouncer as immediate fix for connection pooling",
      "Implement point-in-time recovery for backups",
    ],
    people: ["Elena Vasquez", "David Kim", "Alex Thompson", "Nina Kowalski"],
    topics: ["database migration", "Postgres", "PgBouncer", "read replicas", "connection pooling", "backups"],
  },
  {
    id: "onboarding-09",
    action_items: [
      "Priya share architecture docs reading list on Slack",
      "Jordan complete dev environment setup by today",
      "Jordan read architecture docs and submit first PR by Friday",
      "Priya pair with Jordan to set up environment this afternoon",
      "Priya ensure Jordan has access to Vercel, Supabase, and Linear by end of day",
      "Marcus send Vercel invite to Jordan",
    ],
    decisions: [
      "Jordan starts on frontend team for first quarter",
      "Jordan joins on-call rotation starting month two, observation only first month",
    ],
    people: ["Marcus Rivera", "Jordan Lee", "Priya Patel"],
    topics: ["onboarding", "new hire", "dev environment", "PR process", "on-call rotation"],
  },
  {
    id: "quarter-review-10",
    action_items: [
      "Elena present resource allocation plan by next Friday",
      "Hannah start hiring CS operations manager immediately",
    ],
    decisions: [
      "Increase engineering headcount budget from 3 to 5 roles for Q2",
      "Set Q2 revenue target at $2.1M",
      "Q2 product focus on mobile redesign and AI search only",
      "Approve CS operations manager hire",
    ],
    people: ["Michael Torres", "James Walker", "Elena Vasquez", "Tom Bradley", "Amy Chen", "Hannah Park"],
    topics: ["Q1 review", "revenue", "headcount", "Q2 targets", "mobile redesign", "AI search"],
  },
];
