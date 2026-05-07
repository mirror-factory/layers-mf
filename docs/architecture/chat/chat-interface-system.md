# ChatInterface — Reusable Chat System Architecture

> Single component, multiple configurations. Never recreate — only add flags.

## Overview

`ChatInterface` (`src/components/chat-interface.tsx`) is the **single source of truth** for all chat experiences in Layers. Every chat — main page, portal viewer, experience page, mini-chats — uses the same component with different configuration flags.

## Props / Flags

### Core
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `conversationId` | `string \| null` | `null` | Conversation to load history for |
| `initialPrompt` | `string \| null` | `null` | Auto-send this message on mount |
| `initialTemplateId` | `string \| null` | `null` | Agent template to apply |
| `apiEndpoint` | `string` | `"/api/chat"` | Override the chat API route |
| `extraHeaders` | `Record<string, string>` | `{}` | Additional headers (e.g. portal token) |
| `onConversationUpdated` | `() => void` | — | Callback when conversation changes |
| `actionsRef` | `Ref<ChatActions>` | — | Expose imperative actions to parent |
| `onToolOutput` | `(toolName, output) => void` | — | React to tool completions (e.g. navigate PDF) |

### Portal Mode
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `portalMode` | `boolean` | `false` | Hides model selector, slash commands, context panel, desktop action buttons, mobile menu, artifact panel |
| `portalTitle` | `string` | — | Document title for empty state |
| `portalClientName` | `string` | — | Client name for empty state text |
| `portalBrandColor` | `string` | `"#34d399"` | Brand color for send button, avatars, accents |

### Compact / Embedded Mode
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `compactMode` | `boolean` | `false` | Reduced spacing, no empty state prompts, tighter padding. For floating drawers/panels. |
| `hideContextBar` | `boolean` | `false` | Hides the token counter / context window bar |
| `containerClassName` | `string` | — | Additional CSS classes on outermost wrapper |

## Usage Patterns

### Main Chat Page (`/chat`)
```tsx
<ChatInterface
  conversationId={id}
  onConversationUpdated={refresh}
/>
```

### Portal Viewer (`/portal/[token]`)
```tsx
<ChatInterface
  apiEndpoint="/api/chat/portal"
  extraHeaders={{ "x-portal-token": token }}
  portalMode
  portalTitle="Proposal — Swell"
  portalClientName="BlueWave"
  portalBrandColor="#0DE4F2"
  onToolOutput={handleToolOutput}
/>
```

### Experience Page Floating Drawer
```tsx
<ChatInterface
  apiEndpoint="/api/chat/portal"
  extraHeaders={{ "x-portal-token": token }}
  portalMode
  compactMode
  hideContextBar
  portalBrandColor="#0DE4F2"
/>
```

### Mini-Chat (Connectors, Schedules)
```tsx
<ChatInterface
  apiEndpoint="/api/chat/mcp"
  portalMode
  compactMode
  hideContextBar
  containerClassName="h-[300px]"
/>
```

## What portalMode Hides
- Model selector dropdown
- Slash command autocomplete
- Context/artifact side panel
- Desktop action buttons (attach, chart, settings)
- Mobile three-dot menu
- File tree / artifact viewer
- NeuralMorph avatar (replaced with brand-colored dot)

## What compactMode Changes
- No empty state (quick-start prompts)
- Tighter padding (p-3 instead of p-4/p-6)
- Reduced message spacing (space-y-3 instead of space-y-6)
- Tighter input area padding

## Adding New Flags

When you need new behavior in a specific chat instance:

1. Add the prop to `ChatInterfaceProps` interface
2. Add it to `ChatInterfaceInnerProps` interface
3. Pass it through in the outer `ChatInterface` function
4. Add it to the `ChatInterfaceInner` function signature
5. Use it conditionally in the render

**Never** create a new chat component. Always add a flag to the existing one.

## API Routes

| Route | Used By | Auth |
|-------|---------|------|
| `/api/chat` | Main chat | Supabase session |
| `/api/chat/portal` | Portal viewer, experience page | Public (share_token) |
| `/api/chat/mcp` | MCP mini-chat on connectors | Supabase session |

All routes use `ToolLoopAgent` + `createAgentUIStreamResponse` from AI SDK v6.
The portal route uses `createAdminClient()` (no auth required for public portals).
