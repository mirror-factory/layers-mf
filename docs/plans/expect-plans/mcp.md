# Expect Plan — MCP Servers

## Matrix
Desktop + Mobile × Light + Dark, logged-in user

### S1 — Registry search
1. `/mcp`.
2. Search "granola".
3. **Expect**: curated + official + Smithery results.
4. Each card shows: name, description, auth type (bearer/oauth), source label.

### S2 — Connect via bearer
1. Pick an MCP with bearer auth.
2. Paste API key.
3. **Expect**: "Connecting…" → "Connected" with green badge.
4. **Expect**: tool list populates.

### S3 — Connect via OAuth
1. Pick an MCP with OAuth (e.g. granola).
2. Click "Connect with OAuth".
3. **Expect**: browser redirects to provider auth.
4. On return, tokens stored, status = connected.
5. *(Blocked until deployed — see A5 dependency)*

### S4 — Tools merge into chat
1. After connect, go `/chat`.
2. Type "/" — new MCP tools appear as slash commands.
3. Call one.
4. **Expect**: tool executes via MCP, response streams back.

### S5 — Disconnect
1. `/mcp` → disconnect.
2. **Expect**: tools removed from chat.

### S6 — Health monitoring (TARGET)
1. Disconnect underlying MCP server (simulate outage).
2. Wait for hourly cron.
3. **Expect**: `/mcp` shows red indicator, `error_message` populated.
4. **Expect**: notification fires.

### S7 — Safety review (TARGET)
1. Add a new MCP server.
2. **Expect**: before activation, Gemini Flash review runs.
3. **Expect**: UI shows review progress + checkmark animation on pass.
4. **Expect**: flagged concerns (e.g. broad scopes) surface as warnings.
5. User approves → server activates.

### S8 — Setup assistant (TARGET)
1. Click "How do I get an API key?" on MCP card.
2. **Expect**: assistant opens with step-by-step guide sourced per-provider.
3. **Expect**: links to provider signup, API key page, scopes explanation.

## AI-controllable

### S9 — AI connect
1. In chat: "Connect the Linear MCP server".
2. **Expect**: `connect_mcp_server` fires, prompts for API key via `ask_user`.
3. User provides key.
4. **Expect**: server connected.

### S10 — AI health check
1. In chat: "Is my Granola MCP working?"
2. **Expect**: `mcp_health_check` tool pings server, returns status.
   *(Tool missing — logged)*

## Mobile

### S11 — Mobile MCP list
1. `/mcp` on mobile.
2. Cards stack single-column.
3. Connect form becomes full-screen sheet.
