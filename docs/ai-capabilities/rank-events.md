---
title: rankEvents
description: AI-powered event ranking based on user preferences
type: server
---

# rankEvents

Rank and score a set of events based on user preferences. Use this for "top N" or "best" requests. Returns events for the AI to rank with reasoning.

## Type

**Server-side tool** — Executes on the server, but the actual ranking logic is performed by the AI in its response.

## Input Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventIds` | string[] | Yes | Event IDs to rank |
| `criteria` | string | Yes | What to optimize for (e.g., "romantic date night", "family outdoor fun") |
| `limit` | number | No | How many top results to return (default: 5) |

## Output

```typescript
{
  events: Array<{
    id: string;
    title: string;
    description: string;
    category: EventCategory;
    venue: string;
    city: string;
    startDate: string;
    price: string;
    tags: string[];
    coordinates: [number, number];
  }>;
  criteria: string;
  requestedLimit: number;
}
```

## Example Usage

**User:** "What are the top 3 events for a romantic date night?"

**Workflow:**
1. First call `searchEvents` to find relevant events
2. Then call `rankEvents` with the event IDs and criteria

**Tool Call:**
```json
{
  "eventIds": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003"
  ],
  "criteria": "romantic date night",
  "limit": 3
}
```

## Notes

- This tool provides event data for the AI to reason about ordering
- The AI generates the ranking and explains WHY each event is suitable
- Useful for subjective queries like "best", "top", "most fun", etc.
- Should be used after an initial `searchEvents` call to get candidate events
