# Layers Platform — Investor Overview

## The Problem

Every team of knowledge workers today operates across a fractured landscape of tools. Meeting notes live in Granola. Tasks live in Linear. Strategy docs sit in Google Drive. Team chatter happens on Discord. Files get shared via email, Slack, or Dropbox. The average company uses between 80 and 100 SaaS applications — and the context generated across them never connects.

The result is a compounding information crisis. Decisions made in Tuesday's meeting don't make it into Wednesday's project plan. Action items discussed on a call get lost because nobody transcribed them into the task tracker. A team member spends 30 minutes searching Slack, Drive, and their inbox for a conversation they know happened last week but can't locate. When a new hire joins, there's no single place to get up to speed — just a maze of disconnected tools and tribal knowledge.

This isn't a new problem, but it's getting dramatically worse. As AI tools proliferate, teams generate more content faster than ever — drafts, summaries, transcripts, analyses — but without a unifying layer, all of this output becomes noise instead of signal. The promise of AI-powered productivity collapses when the AI can't see across your entire business.

## The Solution

Layers is the operating system for AI-native companies. It connects every tool a team uses — meeting transcription, project management, documents, communication — into a single context layer, then deploys intelligent agents that actually understand what's happening across the business.

When a meeting ends, Layers automatically ingests the transcript, extracts decisions and action items, links them to the relevant project, and surfaces what needs attention. When a teammate asks "what did we decide about the pricing model last week?", Layers doesn't search a single tool — it searches across everything and delivers a precise, sourced answer.

The magic moment: you open Layers in the morning and see an inbox of items that need your attention — not because you configured alerts, but because an AI agent has been watching your meetings, tasks, documents, and messages, and it knows what matters to you.

Each team member gets a personal AI agent called Ditto — a representation of them and their work context. Ditto learns what you care about, what projects you're working on, and how you like information presented. Over time, Ditto becomes increasingly proactive, surfacing relevant context before you ask and drafting responses based on your patterns.

## How It Works

The Layers experience unfolds in four steps that mirror how knowledge naturally flows through a business.

First, data collection. Layers connects to the tools your team already uses — Google Drive, Linear, Discord, Granola, Google Docs, Sheets, and Slides — through a unified integration hub. Users click "Connect" next to each service, authorize once, and data begins flowing into the Layers context library. There's no manual import, no copy-pasting, no configuration.

Second, intelligent processing. Every piece of incoming content — a meeting transcript, a Linear issue update, a shared document — passes through an AI extraction pipeline. The system identifies who was involved, what was discussed, what decisions were made, what deadlines were set, and which projects the content relates to. This structured metadata is stored alongside the raw content in a multi-level registry, enabling both precise keyword searches and fuzzy semantic queries.

Third, agent-powered workspaces. Users create sessions — scoped project containers where agents operate on curated context. A session for "Q2 Product Launch" pulls in relevant meeting notes, project tasks, and strategy documents, and its dedicated agent monitors for new information that matches. Agents summarize, alert on overdue items, draft follow-up communications, and connect dots across sources that humans would miss.

Fourth, compounding knowledge. Every action the system takes — every summary generated, every connection drawn, every decision logged — feeds back into the context library. Over time, Layers becomes a living memory of the business: not just what files exist, but what was decided, why, by whom, and what happened as a result. This is the compound effect that makes Layers increasingly valuable the longer a team uses it.

## Market Opportunity

The AI agent infrastructure market is experiencing explosive growth. The Model Context Protocol (MCP) ecosystem alone is projected to grow from $1.2 billion to $4.5 billion, with estimates suggesting 90% of organizations will adopt the standard. The broader knowledge management and team productivity space represents a multi-billion dollar opportunity, with tools like Notion ($10B+ valuation), Slack (acquired for $27.7B), and newcomers like Granola (rapidly growing AI meeting tool) demonstrating massive demand for better ways to manage team knowledge.

The critical gap in the market is the *integration layer*. Individual tools do their jobs well — Granola captures great meeting notes, Linear manages tasks beautifully, Google Drive stores documents reliably. But no product connects them into a unified, agent-powered intelligence layer. Current solutions fall into two inadequate categories:

**iPaaS tools (Zapier, Make)** handle simple automations ("when X happens, do Y") but lack the AI intelligence to understand context, extract meaning, or take nuanced action. They move data but don't comprehend it.

**Standalone AI assistants (ChatGPT, Claude)** are powerful reasoners but have no persistent connection to your business tools. You have to manually provide context every time. They forget everything between sessions.

**Unified API platforms (Composio, Nango, Merge)** solve the plumbing problem — connecting to hundreds of APIs through one interface — but they're infrastructure, not products. They provide the pipes but not the intelligence that flows through them.

Layers sits in the white space between all three: it connects like Zapier, reasons like an AI assistant, and builds on unified API infrastructure — but packages it all as a product that teams actually use every day.

| Competitor | Strength | Gap Layers Fills |
|---|---|---|
| Notion AI | Great document workspace | No cross-tool context, no agent autonomy |
| Zapier / Make | Broad integrations | No AI comprehension, just data shuttling |
| ChatGPT / Claude | Strong reasoning | No persistent tool connections, no memory |
| Dust.tt | AI assistant with data connections | Enterprise-focused, complex setup |
| Glean | Enterprise search | Search-only, no agent actions, enterprise pricing |

## Business Model

Layers operates on a base subscription plus usage-based pricing, designed for teams of approximately 100 people.

The base subscription provides the platform — context library, agent infrastructure, integration connections, and the team dashboard. Usage-based pricing scales with AI consumption (agent queries, extraction pipeline runs, embedding generation) so that teams pay proportionally to the value they extract.

For the initial go-to-market, Mirror Factory uses Layers internally as dogfood, then extends to client organizations who see the platform in action. This creates a natural sales motion: clients experience Layers' value through their engagement with Mirror Factory and ask how to get it for their own teams.

The billing infrastructure — Stripe integration, credit tracking, and multi-tenant support — is already built from a prior product phase (Layers Gateway), significantly reducing time to revenue.

Growth levers include per-seat expansion within organizations, increased usage as teams connect more tools and create more sessions, and an integration marketplace where specialized agent templates (sales call analyzer, sprint retrospective summarizer, client onboarding tracker) command premium pricing.

## Competitive Advantage

Layers' defensibility comes from three compounding mechanisms.

**Context accumulation.** Every day a team uses Layers, the context library grows richer. Meeting history, decision logs, project evolution, team communication patterns — this institutional knowledge becomes exponentially more valuable over time and is impossible to replicate by switching to a competitor.

**Agent personalization.** Each team member's Ditto agent learns their preferences, priorities, and communication style. The longer someone uses Layers, the more useful their Ditto becomes — creating individual-level lock-in on top of the organizational data moat.

**Integration network effects.** Each new tool connection makes Layers more valuable because agents can draw from a wider context. A team using Layers with just Google Drive gets value. A team using it with Drive + Linear + Discord + Granola gets dramatically more value because the agent can connect dots across all four sources. This incentivizes teams to connect everything, deepening the platform's utility and switching costs.

The architectural choice to build on open standards (MCP for tool connections, Vercel AI Gateway for model routing) ensures Layers isn't locked to any single AI provider. As models improve, Layers automatically gets smarter — the intelligence layer is model-agnostic.

## Traction & Roadmap

**Current state:** Core infrastructure is built — authentication, payment processing, credit tracking, multi-tenant support, and AI gateway routing are all operational from the Layers Gateway phase. The team is entering the 6-week P1 prototype build.

**P1 (Weeks 1-6):** Context library with multi-source data ingestion, document-first UI with chat interface, AI extraction pipeline, and team inbox. Internal deployment to Mirror Factory's 3-person team. Success metric: daily active use by all team members.

**P2 (Weeks 7-12):** Session workspaces with scoped agents, daily digest/briefing system, and expanded integration coverage. Begin testing with one external client team.

**P3 (Weeks 13-20):** Agent specialization (purpose-built agents for common workflows), Ditto personalization, and client-facing onboarding flow. Target: 3-5 external teams using the platform.

**P4 (Weeks 21+):** Ditto as the primary interface, canvas UI evolution, Easel integration for interactive content, and self-service signup. Target: first revenue from external customers.

## The Team

Mirror Factory is a development studio that builds AI-powered applications for multiple clients, led by Alfonso — a product architect with deep expertise in AI application development, brand strategy, and marketing automation. The studio's portfolio demonstrates the ability to ship production AI products, and its client relationships provide a built-in distribution channel for Layers.

Mirror Factory's existing work across five AI product concepts (content generation, brand development, motion graphics, personal AI assistants) gives the team an unusually broad understanding of what AI-native workflows need — and every one of those products will eventually run on Layers as foundational infrastructure, creating both internal demand and proof points.

## The Ask

Layers is seeking early design partners — teams of 10-100 people who are drowning in tools and want to be the first to experience what an AI-powered business operating system feels like. We're also open to conversations with investors who understand that the next platform shift isn't about building better individual AI tools — it's about building the connective tissue that makes all AI tools work together.

The immediate need is runway for the 6-month development roadmap and resources to expand beyond the founding team. Every dollar invested accelerates the context accumulation flywheel: more users generating more data, making agents smarter, making the platform more valuable, attracting more users.

The companies that figure out context management for the AI era will define the next generation of business infrastructure. Layers is building that future.
