# Next Features — Priority Build List

> From testing session 2026-03-31 ~3AM

---

## 1. Persistent Sandboxes (Snapshots)

**What**: Save sandbox VM state so the next run starts instantly (no npm install).

**How**:
```typescript
// After first run
const snapshotId = await sandbox.snapshot(); // saves filesystem + packages
// Store snapshotId in context_items or a sandbox_snapshots table

// Next run — instant restore
const sandbox = await Sandbox.create({ snapshot: snapshotId });
// Everything is already installed — just run new code
```

**DB change**: Add `sandbox_snapshots` table or store snapshotId on the context_item.

**UI**: Show "Restore from snapshot" option in the artifact panel.

---

## 2. Tool Creation Skill (Interview UI)

**What**: An interactive skill that guides users through creating a new tool via conversation.

**How**: Use the ToolLoopAgent pattern with client-side interactive tools (no execute = pauses for user input):

```typescript
// Client-side tools that render UI and wait for user response
const askQuestion = tool({
  description: 'Ask the user a question',
  inputSchema: z.object({ question: z.string(), options: z.array(z.string()).optional() }),
  // NO execute → renders UI, waits for addToolOutput()
});
```

**Flow**:
```
/skill create
  → Granger asks: "What should this tool do?"
  → User answers
  → Granger asks: "What API does it connect to?"
  → User answers
  → Granger generates the tool code
  → Runs it in sandbox to verify
  → Saves as a skill
```

**Reference**: AI SDK client-side tools (no execute function) + addToolOutput pattern.

---

## 3. File Uploads to Chat (Images, PDFs, Docs)

**What**: Drag-and-drop files into chat for Granger to analyze.

**How**: AI SDK v6 supports `FileUIPart`:
```typescript
sendMessage({
  text: "Analyze this document",
  files: [{ type: 'file', mediaType: 'application/pdf', url: dataUrl, filename: 'report.pdf' }],
});
```

**UI changes**:
- Add file upload button (paperclip icon) next to the send button
- Drag-and-drop zone on the chat input
- Show file previews (image thumbnails, PDF icons) before sending
- Images render inline in the conversation

**Backend**: `convertToModelMessages()` auto-converts FileUIPart to the model's expected format.

---

## 4. Tool Creation via Sandbox

**What**: Create custom tools by writing and testing them in the sandbox, then saving as skills.

**Flow**:
```
User: "Create a tool that fetches weather data from OpenWeather API"
  → Granger writes the tool code
  → Tests it in sandbox (verifies API calls work)
  → Generates a skill definition (SKILL.md + tool schema)
  → Saves to the skills table
  → Tool is immediately available via slash command
```

**Implementation**:
- New `create_tool` meta-tool that:
  1. Generates tool definition (name, description, inputSchema, execute function)
  2. Tests the execute function in sandbox
  3. On success, creates a skill entry with the tool embedded
  4. Registers the slash command dynamically

---

## 5. Reference Files in Skills

**What**: Skills can have reference files (docs, images, templates) that load into context when activated.

**DB change**: Add `reference_files` JSONB column to `skills` table.

**How**: When a skill activates, its reference files load into the system prompt alongside the skill's systemPrompt.

---

## Session Stats (2026-03-30 → 2026-03-31)

| Metric | Value |
|--------|-------|
| Commits | 60 |
| Lines added | ~30,000+ |
| Files created/modified | ~220+ |
| Duration | ~14 hours |
| Features built | 40+ |
| DB tables created | 12 |
| API routes | 30+ |
| Components | 25+ |
| Tools | 20+ |
| Slash commands | 12 |
| Skills | 6 built-in + 23 marketplace |
| Cron jobs | 6 |
| Sub-agents | 5 |
