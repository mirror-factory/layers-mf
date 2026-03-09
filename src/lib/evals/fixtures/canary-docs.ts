/**
 * Canary documents and queries for retrieval quality evaluation.
 *
 * These synthetic documents are inserted into a test org, searched against,
 * then cleaned up. They cover different content types to test retrieval breadth.
 */

export interface CanaryDoc {
  title: string;
  description_short: string;
  description_long: string;
  raw_content: string;
  source_type: string;
  content_type: string;
  entities: Record<string, unknown>;
}

export interface CanaryQuery {
  query: string;
  expectedTitle: string;
}

export const CANARY_PREFIX = "[CANARY-EVAL]";

export const CANARY_DOCS: CanaryDoc[] = [
  {
    title: `${CANARY_PREFIX} Q3 Product Roadmap 2026`,
    description_short: "Strategic roadmap outlining Q3 priorities for the product team.",
    description_long:
      "This document outlines the Q3 2026 product roadmap for Layers. Key initiatives include: " +
      "(1) Knowledge Graph v2 — connecting context items across integrations to surface relationships, " +
      "(2) Real-time Collaboration — multiplayer editing in shared sessions, " +
      "(3) Advanced Analytics Dashboard — KPI tracking for context pipeline health and agent effectiveness, " +
      "(4) Mobile App MVP — read-only companion for reviewing context on the go. " +
      "The team has committed to shipping initiatives 1 and 3 by end of Q3, with 2 and 4 in beta.",
    raw_content:
      "# Q3 2026 Product Roadmap\n\n" +
      "## Priority 1: Knowledge Graph v2\n" +
      "Build relationship mapping between context items. Enable cross-source linking.\n\n" +
      "## Priority 2: Real-time Collaboration\n" +
      "Add multiplayer cursors and live editing to shared sessions.\n\n" +
      "## Priority 3: Analytics Dashboard\n" +
      "Track pipeline health, search quality, and agent effectiveness with KPI cards.\n\n" +
      "## Priority 4: Mobile App MVP\n" +
      "Read-only companion app for iOS and Android.",
    source_type: "upload",
    content_type: "document",
    entities: {
      topics: ["product roadmap", "knowledge graph", "analytics", "mobile app"],
      people: ["Product Team"],
      decisions: ["Ship knowledge graph and analytics by end of Q3"],
    },
  },
  {
    title: `${CANARY_PREFIX} Engineering Onboarding Checklist`,
    description_short: "Step-by-step onboarding guide for new engineering hires.",
    description_long:
      "Complete onboarding checklist for new engineers joining the Layers team. Covers: " +
      "Day 1 setup (GitHub access, Supabase credentials, Vercel team invite), " +
      "Week 1 tasks (run the app locally, complete first PR, attend architecture walkthrough), " +
      "Week 2 milestones (shadow on-call rotation, contribute to a sprint goal), " +
      "30-day expectations (own a feature end-to-end, present at team demo).",
    raw_content:
      "# Engineering Onboarding Checklist\n\n" +
      "## Day 1\n- [ ] Get GitHub org access\n- [ ] Set up Supabase local dev\n- [ ] Join Vercel team\n- [ ] Install pnpm, Node.js 22+\n\n" +
      "## Week 1\n- [ ] Clone repo, run `pnpm dev`\n- [ ] Submit first PR (good-first-issue)\n- [ ] Attend architecture walkthrough\n\n" +
      "## Week 2\n- [ ] Shadow on-call rotation\n- [ ] Contribute to current sprint goal\n\n" +
      "## 30-Day Goal\n- [ ] Own a feature end-to-end\n- [ ] Present at team demo day",
    source_type: "upload",
    content_type: "document",
    entities: {
      topics: ["onboarding", "engineering", "new hire", "checklist"],
      action_items: [
        "Get GitHub org access",
        "Set up Supabase local dev",
        "Submit first PR",
        "Shadow on-call rotation",
      ],
    },
  },
  {
    title: `${CANARY_PREFIX} Sprint 14 Retrospective Notes`,
    description_short: "Team retro notes from Sprint 14 covering wins, challenges, and action items.",
    description_long:
      "Sprint 14 retrospective for the Layers engineering team. " +
      "Wins: shipped hybrid search with RRF scoring, onboarded 3 new Nango integrations (Google Drive, Slack, Linear). " +
      "Challenges: embedding pipeline had 8% error rate due to rate limiting from the AI Gateway, " +
      "agent response times spiked to 20s during peak usage. " +
      "Action items: implement retry logic with exponential backoff for embeddings, " +
      "add model-level caching for repeated queries, investigate streaming latency.",
    raw_content:
      "# Sprint 14 Retrospective\n\n" +
      "## What went well\n- Hybrid search with RRF scoring shipped and validated\n- Google Drive, Slack, and Linear integrations live\n- Context library UI redesign complete\n\n" +
      "## What didn't go well\n- Embedding pipeline errors: 8% failure rate due to AI Gateway rate limits\n- Agent P95 latency hit 20s during peak hours\n- Two flaky tests in CI blocked deploys for 2 days\n\n" +
      "## Action items\n- Add exponential backoff retry for embedding generation\n- Implement model-level query caching\n- Fix flaky CI tests (assign: @eng-lead)\n- Set up monitoring alerts for pipeline error rate > 5%",
    source_type: "upload",
    content_type: "meeting_transcript",
    entities: {
      topics: ["retrospective", "sprint 14", "hybrid search", "embedding pipeline"],
      action_items: [
        "Add exponential backoff retry for embeddings",
        "Implement model-level query caching",
        "Fix flaky CI tests",
        "Set up pipeline monitoring alerts",
      ],
      decisions: [
        "Prioritize retry logic for embedding pipeline",
        "Assign CI fix to eng-lead",
      ],
    },
  },
];

export const CANARY_QUERIES: CanaryQuery[] = [
  {
    query: "What are the Q3 product priorities?",
    expectedTitle: `${CANARY_PREFIX} Q3 Product Roadmap 2026`,
  },
  {
    query: "How do I onboard as a new engineer?",
    expectedTitle: `${CANARY_PREFIX} Engineering Onboarding Checklist`,
  },
  {
    query: "What happened in the sprint retrospective?",
    expectedTitle: `${CANARY_PREFIX} Sprint 14 Retrospective Notes`,
  },
  {
    query: "embedding pipeline error rate",
    expectedTitle: `${CANARY_PREFIX} Sprint 14 Retrospective Notes`,
  },
  {
    query: "knowledge graph roadmap initiative",
    expectedTitle: `${CANARY_PREFIX} Q3 Product Roadmap 2026`,
  },
];
