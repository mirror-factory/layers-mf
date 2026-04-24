# Expect Plan — Skills

## Matrix
Desktop + Mobile × Light + Dark

### S1 — Browse marketplace
1. `/skills`.
2. **Expect**: 6 built-in + 23 marketplace skills listed.
3. Filter by category.
4. Click detail on any skill.

### S2 — Activate skill
1. Click "Activate" on a skill.
2. **Expect**: badge changes to "Active".
3. **Expect**: in chat, `/skill-name` slash command appears.

### S3 — Use activated skill in chat
1. `/chat`, send prompt invoking skill behavior.
2. **Expect**: system prompt extension visible in tool call debug.
3. **Expect**: skill reference files (if any) load into context.

### S4 — Create skill via wizard
1. `/skills` → New Skill.
2. Multi-step: name → description → instructions → tools → save.
3. **Expect**: new skill in "My Skills" tab.

### S5 — Create via chat (Tool Creation Skill)
1. In chat: "/skill create".
2. **Expect**: interview tool `ask_user` asks: name, purpose, example input/output.
3. Answer each.
4. **Expect**: skill scaffold generated.
5. **Expect**: test runs in sandbox.
6. **Expect**: on pass, save prompt.

### S6 — Create tool from code
1. In chat: "Create a tool that computes Fibonacci".
2. **Expect**: `create_tool_from_code` fires.
3. Code runs in sandbox.
4. Tool saved as skill.
5. Immediately callable in chat.

### S7 — Reference files (TARGET)
1. Edit a skill, upload a PDF as reference.
2. **Expect**: `reference_files` column populated.
3. Activate skill, start new chat.
4. **Expect**: reference file loaded into system context.

### S8 — Safety review (TARGET)
1. Create new skill.
2. **Expect**: safety review agent runs on save.
3. **Expect**: checkmark animation on pass.
4. **Expect**: flagged patterns (e.g. exfiltration attempts) block save.

## AI-controllable

### S9 — AI activate
1. Chat: "Activate the 'Linear PM' skill".
2. **Expect**: `activate_skill` tool fires.

### S10 — AI search marketplace
1. Chat: "Find a skill for generating weekly reports".
2. **Expect**: `search_skills_marketplace` returns options.

## Mobile

### S11 — Mobile skills list
1. `/skills` on 393×852.
2. Grid → list.
3. Activate button full-width on card.
