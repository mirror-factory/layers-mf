---
title: AI Capabilities Registry
description: Complete list of AI agent tools and features for Moonshots & Magic
---

# AI Capabilities

The Moonshots & Magic AI assistant uses **Claude Haiku** with 5 specialized tools to help users discover events in Orlando & Central Florida.

## Agent Overview

The `eventAgent` is a `ToolLoopAgent` that can execute up to 10 tool calls per conversation turn. It combines semantic search, AI-powered ranking, and interactive map control to provide a comprehensive event discovery experience.

## Current Model

| Setting | Value |
|---------|-------|
| Provider | Anthropic (via AI Gateway) |
| Model | `claude-haiku` |
| Max Steps | 10 tool calls per turn |

> **Note:** Model selection is configurable via Settings. Haiku provides fast, cost-effective responses for event discovery tasks.

## Available Tools

| Tool | Type | Description |
|------|------|-------------|
| [searchEvents](/docs/ai/search-events) | Server | Search events by category, date, location, price, and keywords |
| [getEventDetails](/docs/ai/get-event-details) | Server | Fetch full details for a single event by ID |
| [rankEvents](/docs/ai/rank-events) | Server | AI-powered ranking based on user preferences |
| [mapNavigate](/docs/ai/map-navigate) | Client | Control the interactive map (fly to, highlight, fit bounds) |
| [searchNewsletters](/docs/ai/search-newsletters) | Server | Search newsletter content for local news and context |

## Architecture

```
User Message → eventAgent → Tool Calls → Tool Results → AI Response
                   │
                   ├── searchEvents (server)
                   ├── getEventDetails (server)
                   ├── rankEvents (server)
                   ├── searchNewsletters (server)
                   └── mapNavigate (client-side, rendered in chat)
```

## Example Queries

- "What's happening this weekend in Orlando?"
- "Find me outdoor events near Lake Eola"
- "What are the top 5 family-friendly events next month?"
- "Show me all music festivals in Central Florida"
- "What food events are free to attend?"

## System Prompt

The agent is configured with guidelines to:
- Explain WHY each event matches the user's criteria
- Always include date, venue, and category in recommendations
- Use the map to visualize event locations
- Search newsletters for additional context
- Suggest broadening search criteria when no matches are found

---

## Upcoming Features

Based on the AI SDK and AI Elements capabilities, these features are planned for future releases:

### Human-in-the-Loop Confirmations

**Status:** Planned

Tool approval workflow for sensitive operations using the `Confirmation` component:

- **Delete confirmations** — Require user approval before removing saved events
- **Booking confirmations** — Confirm before redirecting to ticket purchases
- **Sharing confirmations** — Approve before sharing event details externally

```
User: "Book tickets for the Jazz Festival"
Agent: [Confirmation request with event details and price]
User: [Approve / Reject]
Agent: [Proceeds or cancels based on response]
```

### Dynamic UI Elements

**Status:** Planned

Custom tool UI components rendered inline in chat:

| Component | Use Case |
|-----------|----------|
| `EventCard` | Rich event preview with image, date, venue |
| `EventList` | Scrollable list with sorting/filtering |
| `MapPreview` | Inline map thumbnail with event pins |
| `DatePicker` | Interactive date range selector |
| `CategoryPicker` | Visual category filter chips |

### Sub-Agent Architecture

**Status:** Research

Specialized sub-agents for complex multi-step workflows:

- **PlannerAgent** — Creates itineraries combining multiple events
- **ComparisonAgent** — Side-by-side event comparison with pros/cons
- **RecommendationAgent** — Personalized suggestions based on history
- **NotificationAgent** — Schedules reminders for upcoming events

### Reasoning & Chain-of-Thought

**Status:** Planned

Using the `Reasoning` component to show AI thinking:

- Display step-by-step reasoning for ranking decisions
- Show search strategy before executing queries
- Explain why certain events were filtered out

### Context & Memory

**Status:** Planned

Using the `Context` component for persistent memory:

- Remember user preferences (favorite categories, locations)
- Track previously viewed events
- Build user taste profile over time

### Voice Input

**Status:** Research

Speech-to-text for hands-free event discovery:

- Voice queries while driving/walking
- Natural language date expressions ("next Saturday")
- Location-aware suggestions ("events near me")

### Model Selection

**Status:** In Development

Settings panel for model configuration:

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| Haiku | Fast | Low | Quick searches, simple queries |
| Sonnet | Medium | Medium | Complex rankings, detailed recommendations |
| Opus | Slow | High | Multi-step planning, nuanced analysis |

### Inline Citations

**Status:** Planned

Using the `InlineCitation` component for source attribution:

- Link to original event listings
- Reference newsletter articles
- Cite venue information sources

### Task Progress

**Status:** Planned

Using the `Task` component for multi-step operations:

- Show progress for "plan my weekend" requests
- Display search/filter/rank pipeline steps
- Indicate when fetching external data
