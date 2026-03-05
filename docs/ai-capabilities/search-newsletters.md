---
title: searchNewsletters
description: Search newsletter content for local news and context
type: server
---

# searchNewsletters

Search newsletter content for information about events, news, culture, food, and local happenings in Orlando & Central Florida.

## Type

**Server-side tool** — Executes on the server and returns matching newsletter entries.

## Input Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | Max results to return (default: 5) |

## Output

```typescript
{
  count: number;
  newsletters: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    source: string;
    author: string;
    publishedAt: string;
    tags: string[];
  }>;
}
```

## Example Usage

**User:** "What's the buzz about new restaurants opening in downtown Orlando?"

**Tool Call:**
```json
{
  "query": "new restaurants downtown Orlando",
  "limit": 5
}
```

## Notes

- Useful for providing context beyond structured event data
- Searches across title, summary, body, and tags
- Returns recent local news, culture pieces, and event previews
- Helps the AI give more informed, contextual recommendations
- The registry is queried in-memory from static JSON data
