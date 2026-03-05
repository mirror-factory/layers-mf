---
title: searchEvents
description: Search the event registry with multi-criteria filters
type: server
---

# searchEvents

Search the event registry by criteria. Use this to find events matching user preferences like category, date range, price, location, or text search.

## Type

**Server-side tool** — Executes on the server and returns structured data.

## Input Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Text search on title, description, tags, venue |
| `category` | enum | No | Event category filter (music, arts, sports, food, tech, community, family, nightlife, outdoor, education, festival, market, other) |
| `dateRange` | object | No | Date range with `start` and `end` (ISO 8601) |
| `city` | string | No | City name filter |
| `isFree` | boolean | No | Filter for free events only |
| `tags` | string[] | No | Filter by tags |
| `limit` | number | No | Max results to return (default: 10) |

## Output

```typescript
{
  count: number;
  events: Array<{
    id: string;
    title: string;
    description: string;
    category: EventCategory;
    venue: string;
    city: string;
    startDate: string;
    endDate: string;
    price: string;
    tags: string[];
    coordinates: [number, number];
    featured: boolean;
  }>;
}
```

## Example Usage

**User:** "Find me outdoor events in Winter Park next weekend"

**Tool Call:**
```json
{
  "query": "outdoor",
  "city": "Winter Park",
  "dateRange": {
    "start": "2026-02-07",
    "end": "2026-02-09"
  }
}
```

## Notes

- Results are filtered to only return `status: "active"` events
- The registry is queried in-memory from static JSON data
- For "top N" or "best" requests, use `rankEvents` after initial search
