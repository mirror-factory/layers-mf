# Expect Plan — Chat

> Run: `EXPECT_BASE_URL=http://localhost:3000 npx expect-cli --agent claude -m "$(cat docs/plans/expect-plans/chat.md)" -y`

## Matrix
Desktop 1440×900 + Mobile 393×852 × Light + Dark

## Core

### S1 — Send + stream
1. `/chat` → new conversation.
2. Send "What is in my context library?"
3. **Expect**: streaming response with `search_context` tool call visible.
4. **Expect**: sources with relevance scores rendered.
5. **Expect**: context window bar updates.

### S2 — Stop generation
1. Send a long prompt ("Write 3000 words on X").
2. Click stop 2s into stream.
3. **Expect**: stream halts, partial message preserved, can send next message.

### S3 — @ Mention picker (people)
1. Type "@".
2. **Expect**: dropdown with People + Library tabs.
3. Navigate to "People" tab.
4. Select org member.
5. **Expect**: chip renders in input with member name.
6. Send message.
7. **Expect**: mentioned member gets notification.

### S4 — @ Mention picker (library)
1. Type "@".
2. Click "Library" tab.
3. Search "meeting".
4. Select a document.
5. **Expect**: document chip renders.
6. Send.
7. **Expect**: AI references that document in response.

### S5 — Branch conversation
1. In a 5-message thread, click "branch" on message #3.
2. **Expect**: new conversation starts with messages 1-3 copied.
3. Send new message in branch.
4. **Expect**: original conversation unchanged.

### S6 — Share conversation
1. Click Share.
2. Add user by email.
3. Set permission "view".
4. **Expect**: recipient sees conversation in their "Shared with Me" library section.
5. Recipient opens — cannot send messages (view only).

### S7 — Model selector
1. Click model dropdown.
2. Switch Haiku → Sonnet.
3. Send message.
4. **Expect**: response metadata shows model=sonnet-4.5.

### S8 — Slash commands autocomplete
1. Type `/`.
2. **Expect**: dropdown with 12 commands.
3. Type `sch`.
4. **Expect**: filters to `/schedule`.
5. Select.
6. **Expect**: command inserts into input.

### S9 — Ambient AI card
Precondition: conversation has 5+ messages discussing a clear action item.
1. **Expect**: ambient card appears suggesting an action.
2. Click "Accept".
3. **Expect**: action routed to `propose_action` or directly executed.
4. Click "Dismiss" on another card.
5. **Expect**: card fades out.

### S10 — Stop + continue
1. Send prompt.
2. Stop mid-stream.
3. Send follow-up "continue".
4. **Expect**: AI picks up context coherently.

## AI-Controllable

### S11 — AI can search chat history
1. Send "Find a conversation where we discussed Stripe".
2. **Expect**: `search_chat_history` tool fires.
3. **Expect**: returns results with links.

### S12 — AI can branch via tool
1. Send "Branch this conversation and rename the new one 'planning'".
2. **Expect**: `branch_conversation` tool fires.
3. **Expect**: new conversation created and visible in sidebar.

## Edge cases

### S13 — Long context compaction
1. Send 30+ messages.
2. **Expect**: compaction middleware fires silently.
3. **Expect**: context window bar stays under limit.

### S14 — Network drop
1. Mid-stream, simulate offline.
2. Go back online.
3. **Expect**: resumable stream or clear error + retry button.

### S15 — Tool error
1. Call a tool that errors (mock: disconnect MCP server).
2. **Expect**: tool card shows error state, AI explains and offers alternative.
3. Does NOT crash the chat.

## Mobile

### S16 — Mobile input
1. On 393×852: chat input auto-expands as you type.
2. Enter = send (NOT Shift+Enter line break on mobile).
3. Keyboard doesn't obscure last message.

### S17 — Mobile artifact
1. Open artifact (via `write_code` prompt).
2. **Expect**: slides up from bottom (not right side).
3. Swipe down to dismiss.

## Dark Mode

### S18 — Dark mode contrast
1. Toggle dark.
2. **Expect**: every component meets AA contrast.
3. Code blocks use dark theme (not white flashing).
4. Ambient card readable.
