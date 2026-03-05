---
title: getEventDetails
description: Fetch full details for a single event by ID
type: server
---

# getEventDetails

Get full details for a specific event by its ID.

## Type

**Server-side tool** — Executes on the server and returns the complete event record.

## Input Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | Yes | The event UUID |

## Output

Returns the full `EventEntry` object:

```typescript
{
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  tags: string[];
  venue: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: [number, number];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  price: string;
  ticketUrl?: string;
  imageUrl?: string;
  organizer: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  featured: boolean;
  status: "active" | "cancelled" | "postponed";
  createdAt: string;
  updatedAt: string;
}
```

Or if not found:

```typescript
{ error: "Event not found" }
```

## Example Usage

**User:** "Tell me more about the Food Truck Rally"

**Tool Call:**
```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440001"
}
```

## Notes

- Use this after `searchEvents` when the user wants detailed information
- Returns complete event data including contact info and ticket URLs
- Error response includes an `error` field when event ID is invalid
