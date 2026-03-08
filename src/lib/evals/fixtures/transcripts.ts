/**
 * 10 anonymized meeting transcripts for extraction eval (PROD-133).
 * Each transcript has clear action items, decisions, people, and topics.
 */

export interface TranscriptFixture {
  id: string;
  filename: string;
  transcript: string;
}

export const TRANSCRIPTS: TranscriptFixture[] = [
  {
    id: "sprint-planning-01",
    filename: "Sprint 22 Planning — 2026-02-24.txt",
    transcript: `Sprint 22 Planning Meeting
Date: February 24, 2026
Attendees: Sarah Chen (PM), Marcus Rivera (Eng Lead), Priya Patel (Frontend), David Kim (Backend), Lisa Zhang (Design)

Sarah: Let's go through the backlog. First up is the search relevance improvement ticket.

Marcus: I've been looking at this. We need to switch from pure BM25 to a hybrid approach with vector search. David, can you set up the pgvector extension by Wednesday?

David: Yes, I'll have the migration ready by Wednesday EOD. I'll also need to update the RPC functions.

Sarah: Good. Priya, the new onboarding flow — where are we on that?

Priya: I have the wireframes from Lisa. I can start building the component this sprint. I'll have a working prototype by Friday.

Lisa: I'll finalize the mobile responsive designs by Tuesday so Priya has what she needs.

Sarah: Perfect. One more thing — we decided to drop the legacy CSV export feature. Nobody's used it in 3 months and it's blocking the new API work.

Marcus: Agreed. That saves us about a week of maintenance. I'll remove the endpoints and the frontend code.

Sarah: OK let's also decide on the API versioning strategy. Marcus, what do you recommend?

Marcus: I recommend URL-based versioning with /v1/ prefix. It's the simplest and most explicit approach.

Sarah: Everyone agree? [agreement] OK, we're going with URL-based versioning. David, please update the API documentation by end of sprint.

David: Will do.

Sarah: Summary — David has the pgvector migration by Wednesday and API docs update by sprint end. Priya starts the onboarding flow prototype by Friday. Lisa delivers mobile designs by Tuesday. Marcus removes CSV export endpoints. Let's ship it.`,
  },
  {
    id: "product-review-02",
    filename: "Product Review — Analytics Dashboard — 2026-02-26.txt",
    transcript: `Product Review: Analytics Dashboard
Date: February 26, 2026
Attendees: James Walker (VP Product), Sarah Chen (PM), Wei Liu (Data Eng), Rachel Green (UX Research)

James: Let's review the analytics dashboard proposal. Sarah, walk us through it.

Sarah: The dashboard will show three main KPIs: daily active users, feature adoption rates, and time-to-value for new signups. We want to ship an MVP by end of March.

Wei: I can build the data pipeline. We need a new materialized view for the adoption metrics. I'll have it ready in two weeks.

Rachel: From the user research, people want to see trends over time, not just snapshots. We should include 7-day and 30-day rolling averages.

James: Good insight. Let's make rolling averages the default view. Sarah, add that to the spec.

Sarah: Done. One question — should we gate this behind a feature flag or ship to everyone?

James: Let's gate it behind a flag initially. Pro tier only for the first month, then we'll decide on broader rollout based on engagement.

Sarah: OK so the decision is: analytics dashboard ships behind a feature flag, Pro tier only initially.

Wei: I'll also need to set up the Clickhouse connection for the raw event stream. That's a prerequisite. Rachel, can you provide the list of events we need to track?

Rachel: I'll send you the event taxonomy document by Thursday.

James: Let's reconvene in two weeks for a progress check. Sarah, schedule that.

Sarah: Will do. Action items: Wei builds the materialized view and Clickhouse connection, Rachel sends event taxonomy by Thursday, I update the spec with rolling averages and schedule the follow-up.`,
  },
  {
    id: "retro-03",
    filename: "Engineering Retrospective — Sprint 21 — 2026-02-21.txt",
    transcript: `Sprint 21 Retrospective
Date: February 21, 2026
Attendees: Marcus Rivera (Eng Lead), Priya Patel, David Kim, Alex Thompson, Nina Kowalski

Marcus: Let's start with what went well.

Priya: The new component library is paying off. I built the settings page in half the time it would have taken before.

Alex: The CI pipeline improvements are great. Build times went from 8 minutes to under 3.

Marcus: Nice. What didn't go so well?

David: We had two production incidents this sprint. Both were related to missing input validation on the API. We need to add Zod schemas to all public endpoints.

Nina: The code review process is too slow. PRs are sitting for 24-48 hours before getting reviewed.

Marcus: Let's address both. David, can you create a tracking issue for the Zod validation work and start with the most critical endpoints?

David: Yes, I'll prioritize the auth and payment endpoints first. Should have those done by next Friday.

Marcus: For code reviews — I propose we adopt a 4-hour SLA for first review. If you're tagged, you respond within 4 hours during business hours.

Alex: That works for me. We should also set up review assignment rotation so it's fair.

Marcus: Good idea. Alex, can you set up the GitHub CODEOWNERS file and review rotation by Monday?

Alex: On it.

Nina: One more thing — we need better error monitoring. I spent hours debugging the payment issue because we didn't have enough context in the logs.

Marcus: Agreed. Nina, please evaluate Sentry vs LogRocket and present a recommendation at next week's standup.

Marcus: Decisions made: 4-hour SLA for code reviews, Zod validation on all public API endpoints. Let's make sprint 22 better.`,
  },
  {
    id: "sales-sync-04",
    filename: "Sales Team Sync — 2026-02-27.txt",
    transcript: `Sales Team Weekly Sync
Date: February 27, 2026
Attendees: Tom Bradley (Sales Director), Jennifer Liu (AE), Ryan O'Brien (AE), Katie Martinez (SDR Lead)

Tom: Pipeline update. Where are we on Q1 targets?

Jennifer: I'm at 78% of quota. I have three deals in final negotiation. The Meridian Corp deal should close this week — they've verbally committed to the Enterprise plan.

Ryan: I'm at 62%. The Oakville Health deal is stalled. Their legal team wants a BAA before they can proceed. Tom, can you get legal to prioritize the BAA review?

Tom: I'll talk to legal today and push for a 48-hour turnaround on the BAA.

Katie: Inbound leads are up 30% this month thanks to the webinar. I need help qualifying them faster. Can we get an SDR dedicated to webinar follow-ups?

Tom: Let's trial that. Katie, draft a job description for a webinar SDR role and have it to me by Monday.

Jennifer: On the Meridian deal — they're asking for a custom SSO integration. Is that something engineering can do in the next 30 days?

Tom: I'll check with Sarah on the product side. Jennifer, send me the technical requirements and I'll set up a call with engineering by end of week.

Ryan: I also want to flag — three prospects this month asked about SOC 2 compliance. We need that certification to compete in healthcare and finance verticals.

Tom: Noted. I'll raise SOC 2 at the leadership meeting next Tuesday. It's becoming a blocker for multiple deals.

Tom: Decisions — we're trialing a dedicated webinar SDR role. Action items are clear. Let's close Q1 strong.`,
  },
  {
    id: "design-review-05",
    filename: "Design Review — Mobile App Redesign — 2026-02-25.txt",
    transcript: `Design Review: Mobile App Redesign
Date: February 25, 2026
Attendees: Lisa Zhang (Design Lead), Sarah Chen (PM), Priya Patel (Frontend), Omar Hassan (Mobile Dev)

Lisa: I'm presenting three concepts for the mobile navigation redesign. Option A is a bottom tab bar, Option B is a hamburger menu with gesture navigation, and Option C is a hybrid approach.

Sarah: What does the user testing data say?

Lisa: Users overwhelmingly preferred Option A — the bottom tab bar. 85% task completion rate versus 67% for Option B. Option C was close at 79%.

Omar: From an implementation perspective, Option A is also the simplest. I can build it in one sprint versus two for Option C.

Sarah: Let's go with Option A — bottom tab bar navigation. It has the best usability data and fastest implementation time.

Lisa: Agreed. I'll update the design system with the new navigation components by Thursday.

Priya: We should also update the web version to match. I'll create a shared navigation component library that works across web and mobile.

Omar: One concern — the current app has 7 top-level sections. The tab bar can only fit 5. Which two do we deprioritize?

Sarah: Let's move Settings and Help into a profile/more menu. They have the lowest usage.

Lisa: I'll design the profile menu to house those. Omar, can you set up the React Native navigation structure by Wednesday?

Omar: Yes. I'll also need to coordinate with David on the deep linking changes. I'll set up a sync with him.

Sarah: Great. Lisa delivers updated design system by Thursday, Omar sets up navigation structure by Wednesday, Priya builds shared component library. Let's ship the mobile redesign by end of March.`,
  },
  {
    id: "executive-strategy-06",
    filename: "Executive Strategy Session — Q2 Planning — 2026-02-28.txt",
    transcript: `Executive Strategy Session: Q2 2026 Planning
Date: February 28, 2026
Attendees: Michael Torres (CEO), James Walker (VP Product), Elena Vasquez (VP Eng), Tom Bradley (VP Sales), Amy Chen (CFO)

Michael: Q1 results are looking strong. Revenue is up 22% QoQ. Let's plan Q2.

James: Product-wise, I want to launch the AI-powered search feature. It's our biggest differentiator and customers have been asking for it.

Elena: We'll need to hire two ML engineers. The current team can build the infrastructure but we need specialists for the ranking models.

Michael: Amy, do we have budget for two ML hires?

Amy: Yes, we have headcount budget for three engineering roles in Q2. Two ML engineers fit within that.

Michael: Let's approve the ML engineering hires. Elena, start the recruiting process immediately.

Tom: From sales, our biggest Q2 opportunity is the enterprise segment. We need SOC 2 certification to unlock healthcare and financial services deals worth roughly $2M in pipeline.

Elena: SOC 2 audit takes 3-4 months. If we start in March, we'd have it by June or July.

Michael: Let's prioritize SOC 2. Elena, engage an audit firm by mid-March.

Amy: Budget-wise, SOC 2 audit costs around $50K-$80K. I'll allocate from the compliance budget.

James: One more thing — we should decide on pricing for the AI features. I recommend a $20/seat/month add-on for the AI tier.

Michael: Let's go with the $20 AI tier add-on. Tom, build that into the Q2 sales playbook.

Tom: Will do. I'll have the updated pricing and sales materials ready by March 15.

Michael: Summary — three big bets for Q2: AI search launch, SOC 2 certification, enterprise push. Let's execute.`,
  },
  {
    id: "customer-success-07",
    filename: "Customer Success Review — Churn Analysis — 2026-02-20.txt",
    transcript: `Customer Success Review: Churn Analysis
Date: February 20, 2026
Attendees: Hannah Park (CS Director), Michelle Torres (CSM), Kevin Wright (CSM), Sarah Chen (PM)

Hannah: Let's review February churn. We lost 4 accounts this month, up from 2 last month.

Michelle: Two of mine churned — both cited the same issue. They couldn't get their team to adopt the product because onboarding was too complex.

Kevin: Similar feedback from my churned account. They said the initial setup took over 2 hours and they lost half the team during that process.

Hannah: This is a clear pattern. Sarah, can product prioritize a simplified onboarding flow?

Sarah: We're actually starting that this sprint. Priya is building a guided wizard that should cut setup time to under 15 minutes.

Hannah: Great. Kevin, can you create a feedback loop? Interview the churned customers and document the specific friction points so product can address them.

Kevin: I'll schedule exit interviews with all four churned accounts by end of this week.

Michelle: I also think we need automated check-in emails at day 1, day 7, and day 30. Right now we're doing it manually and things fall through the cracks.

Hannah: Good point. Michelle, draft the email sequences and share with marketing for review by Wednesday.

Hannah: Let's also decide on the health score thresholds. I propose: below 40 is at-risk, 40-70 is monitor, above 70 is healthy.

Kevin: That matches what I'm seeing. Accounts below 40 almost always churn within 60 days.

Hannah: Decision made — health score thresholds are set at 40/70. Michelle, update the CS playbook to reflect the new thresholds.

Hannah: One more decision — we're implementing mandatory 30-day business reviews for all at-risk accounts. That starts immediately.`,
  },
  {
    id: "infrastructure-08",
    filename: "Infrastructure Planning — Database Migration — 2026-02-22.txt",
    transcript: `Infrastructure Planning: Database Migration
Date: February 22, 2026
Attendees: Elena Vasquez (VP Eng), David Kim (Backend), Alex Thompson (DevOps), Nina Kowalski (SRE)

Elena: We need to migrate from the single Postgres instance to a clustered setup. Current DB is at 80% capacity and we're seeing latency spikes during peak hours.

David: I recommend PgBouncer for connection pooling as a first step. That should buy us 2-3 months while we plan the full migration.

Alex: I can set up PgBouncer on the current infrastructure by Friday. It's a low-risk change.

Elena: Do it. Alex, PgBouncer setup by Friday.

Nina: For the longer-term solution, I've evaluated three options: Aurora Postgres, Citus for horizontal sharding, and read replicas. My recommendation is read replicas first — it covers 90% of our read-heavy workload.

Elena: Cost difference?

Nina: Aurora would be 3x our current cost. Read replicas add about 40%. Citus requires significant application changes.

Elena: Let's go with read replicas. Nina, create the migration plan and have it reviewed by the team by next Wednesday.

David: I'll need to update the application code to route read queries to the replicas. That's probably a 2-week effort.

Elena: David, start the application code changes after Nina's migration plan is approved. Target completion by March 15.

Alex: We also need to improve our backup strategy. Current backups run once daily. I recommend point-in-time recovery with continuous WAL archiving.

Elena: Approved. Alex, implement PITR alongside the PgBouncer work.

Elena: Decisions: we're going with read replicas over Aurora or Citus. PgBouncer as immediate fix. PITR for backups. David, David and Nina coordinate on the migration timeline.`,
  },
  {
    id: "onboarding-09",
    filename: "New Hire Orientation — Engineering Team — 2026-02-19.txt",
    transcript: `New Hire Orientation: Engineering Team
Date: February 19, 2026
Attendees: Marcus Rivera (Eng Lead), Jordan Lee (New Hire), Priya Patel (Buddy)

Marcus: Welcome Jordan. Let's get you set up. First, Priya is your onboarding buddy for the first month. She'll help you navigate the codebase and team processes.

Priya: Happy to help. Jordan, I've prepared a reading list of our architecture docs. I'll share it on Slack after this meeting.

Jordan: Thanks. What's the tech stack?

Marcus: Next.js with TypeScript on the frontend, Supabase for the backend, Vercel for deployment. We use pnpm as our package manager.

Priya: Your first task is to fix a small UI bug in the settings page — issue #247. It's a good way to learn the PR process.

Marcus: For your first week, I want you to: complete the dev environment setup by today, read through the architecture docs, and submit your first PR by Friday. Don't worry about making it perfect — we'll provide detailed feedback.

Jordan: Should I use any specific branching strategy?

Marcus: Yes, feature branches off main with conventional commit messages. Priya can show you our PR template.

Priya: I'll pair with you this afternoon to get your environment set up. We also need to get you access to Vercel, Supabase dashboard, and the Linear board.

Marcus: Right. Priya, make sure Jordan has access to all developer tools by end of day. I'll send the Vercel invite now.

Marcus: One decision — Jordan, you'll be starting on the frontend team for your first quarter. After that, we'll discuss whether you want to move to backend or stay frontend based on your interests.

Priya: I'll also add you to the on-call rotation starting month two. First month is observation only.`,
  },
  {
    id: "quarter-review-10",
    filename: "Q1 Quarter End Review — 2026-03-01.txt",
    transcript: `Q1 Quarter End Review
Date: March 1, 2026
Attendees: Michael Torres (CEO), James Walker (VP Product), Elena Vasquez (VP Eng), Tom Bradley (VP Sales), Amy Chen (CFO), Hannah Park (CS Director)

Michael: Let's review Q1 performance against targets.

Amy: Revenue hit $1.8M, beating our $1.6M target by 12%. Gross margin is at 72%, up from 68% last quarter.

Tom: Sales closed 18 new accounts versus a target of 15. Average deal size increased 25% thanks to the enterprise push. Net revenue retention is at 115%.

Hannah: Customer satisfaction is at 4.2 out of 5. Churn decreased to 3.5% monthly from 4.1% after we implemented the onboarding improvements.

James: Product shipped 3 major features: the knowledge search, integration hub, and the analytics dashboard MVP. We missed the mobile redesign — that's moving to Q2.

Elena: Engineering velocity increased 15%. We reduced average PR merge time from 36 hours to 18 hours after implementing the review SLA.

Michael: Excellent results overall. Let's discuss Q2 adjustments.

Amy: I recommend increasing the engineering headcount budget from 3 to 5 roles given the revenue outperformance. We can afford it.

Michael: Approved. Elena, you now have 5 engineering headcount for Q2.

Tom: I want to raise our Q2 revenue target from $2M to $2.2M based on the pipeline strength.

Michael: Let's be aggressive but realistic. Set the target at $2.1M.

James: For product, I propose we add the mobile redesign and AI search as the two flagship Q2 deliverables. Everything else is maintenance and technical debt.

Michael: Agreed. Focus on those two. Elena, allocate engineering resources accordingly.

Elena: Will do. I'll present the resource allocation plan by next Friday.

Hannah: I'd like budget approval for a CS operations manager to handle the new onboarding automation.

Michael: Approved. Hannah, start hiring immediately.

Michael: Great quarter everyone. Q2 targets: $2.1M revenue, mobile redesign and AI search shipped, 5 new eng hires, CS ops manager hired. Let's go.`,
  },
];
