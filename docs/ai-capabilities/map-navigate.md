---
title: mapNavigate
description: Control the interactive map from the chat
type: client
---

# mapNavigate

Control the interactive map. Use this to show events on the map, fly to locations, or highlight clusters. This is a client-side tool.

## Type

**Client-side tool** — Has no server-side execute function. The tool invocation is serialized to the UI stream and rendered by the `MapAction` component, which performs the actual map operation.

## Input Schema

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | Yes | Map action: `flyTo`, `highlight`, or `fitBounds` |
| `coordinates` | [number, number] | No | `[longitude, latitude]` for flyTo |
| `eventIds` | string[] | No | Event IDs to highlight on map |
| `zoom` | number | No | Zoom level (1-20) |

## Actions

### flyTo

Smoothly animate the camera to a specific location.

```json
{
  "action": "flyTo",
  "coordinates": [-81.3730, 28.5431],
  "zoom": 15
}
```

### highlight

Highlight specific events on the map (e.g., pulse animation, different color).

```json
{
  "action": "highlight",
  "eventIds": ["550e8400-e29b-41d4-a716-446655440001"]
}
```

### fitBounds

Adjust the map view to fit all specified events or a bounding box.

```json
{
  "action": "fitBounds",
  "eventIds": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```

## Example Usage

**User:** "Show me where Lake Eola events are happening"

**Tool Call:**
```json
{
  "action": "flyTo",
  "coordinates": [-81.3730, 28.5431],
  "zoom": 15
}
```

## Client-Side Implementation

The tool call is rendered in the chat UI as a `MapAction` component:

```tsx
<MapAction
  action="flyTo"
  coordinates={[-81.3730, 28.5431]}
  zoom={15}
/>
```

The component uses `useMap()` to access the MapLibre instance and calls `map.flyTo()` with the specified parameters.

## Notes

- This tool allows the AI to control the map without server-side map access
- Actions are executed on the client when the tool result is rendered
- Multiple map actions can be combined in a single response
- The AI should use this alongside search results to help users visualize locations
