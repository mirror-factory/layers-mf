# Expect Plan — All Tools (36 total)

> Each tool gets a round-trip test in chat. This is the exhaustive per-tool matrix.
> Each test is terse — expects tool fires, arguments sane, output renders correctly.

## Retrieval Tools

### search_context
- Chat: "What did we discuss about Stripe last week?"
- **Expect**: fires with `query="Stripe"`, returns chunks with source badges + relevance scores.

### get_document
- Chat (after search): "Open that full document."
- **Expect**: fires with `id=<uuid>`, returns full content.

### search_chat_history
- Chat: "Find conversations mentioning Linear PM."
- **Expect**: fires with query, returns message excerpts + conversation links.

### search_skills_marketplace
- Chat: "Find a skill for email drafts."
- **Expect**: returns skills with activate buttons.

### search_mcp_servers
- Chat: "Search MCP registry for Notion."
- **Expect**: returns Notion MCP with connect button.

### ai_sdk_reference
- Chat: "How do I stream text in Vercel AI SDK?"
- **Expect**: fires, returns excerpt from local docs.

### web_search
- Chat: "Search the web for Anthropic's latest Claude release."
- **Expect**: Perplexity via gateway, citations rendered.

### web_browse
- Chat: "Fetch https://anthropic.com/news."
- **Expect**: returns page text, rendered as markdown.

## Scheduling Tools

### schedule_action
- Chat: "Remind me every Monday at 9am to review Linear."
- **Expect**: fires with cron, creates schedule.

### list_schedules
- Chat: "What schedules do I have?"
- **Expect**: lists all with names + cron.

### edit_schedule
- Chat: "Change that Monday schedule to Tuesday."
- **Expect**: updates cron string.

### delete_schedule
- Chat: "Cancel the Monday reminder."
- **Expect**: row deleted, confirmation.

## Artifact Tools

### write_code
- Chat: "Write a Python script that prints hello."
- **Expect**: artifact panel opens with code.

### edit_code
- Chat (after artifact exists): "Change 'hello' to 'hi'."
- **Expect**: diff + apply, `editDescription` logged.

### run_code
- Chat: "Run that script."
- **Expect**: sandbox output in panel.

### run_project
- Chat: "Create a tiny Next.js site and run it."
- **Expect**: multi-file, Live preview iframe loads.

### artifact_panel
- Chat: "Open the artifact panel."
- **Expect**: panel opens.

### artifact_list
- Chat: "List my artifacts."
- **Expect**: list rendered.

### artifact_get
- Chat: "Show artifact <id>."
- **Expect**: loads into panel.

### artifact_version
- Chat: "Show versions of that artifact."
- **Expect**: version history rendered.

### artifact_delete
- Chat: "Delete artifact <id>."
- **Expect**: confirmation + deletion.

### create_document
- Chat: "Create a doc titled 'Plan'."
- **Expect**: TipTap opens in panel.

### edit_document
- Chat (with doc open): "Edit section 2 to be shorter."
- **Expect**: targeted edit, not full rewrite.

## Approval Tools

### propose_action
- Chat: "Send Kyle an email about the meeting."
- **Expect**: proposes action → approval queue, inline approve button.

### list_approvals
- Chat: "What approvals are pending?"
- **Expect**: lists with approve/reject per row.

## Skill/MCP Tools

### activate_skill
- Chat: "Activate the Linear PM skill."
- **Expect**: fires, skill becomes active.

### create_skill
- Chat: "/skill create Weekly Report generator".
- **Expect**: wizard flow.

### create_tool_from_code
- Chat: "Create a tool from this code: `function fib(n){…}`."
- **Expect**: sandbox test → save as tool.

### connect_mcp_server
- Chat: "Connect MCP server https://foo.mcp/mcp with key XXX."
- **Expect**: connection + tool discovery.

### disconnect_mcp_server
- Chat: "Disconnect foo."
- **Expect**: tools removed.

### list_mcp_servers
- Chat: "What MCPs do I have?"
- **Expect**: list.

## Meta Tools

### ask_user
- Chat (invoked by interview skill): AI asks for input.
- **Expect**: interview UI form renders, submit continues.

### branch_conversation
- Chat: "Branch this conversation as 'planning'."
- **Expect**: new thread created.

### review_compliance
- Chat: "Review this document for security risks: <content>."
- **Expect**: returns findings.

### ingest_github_repo
- Chat: "Ingest github.com/vercel/ai."
- **Expect**: clone + parse + embed; summary returned.

### express
- Chat: *(confirm purpose; TBD documentation)*

### weather
- Chat: "What's the weather in NYC?"
- **Expect**: returns temperature + condition.

## Missing Tools (add to AI Tool Coverage Matrix)

- `share_conversation`
- `stop_generation`
- `artifact_panel_close`
- `artifact_view_switch`
- `doc_highlight_range`
- `doc_format_selection`
- `doc_insert_heading`
- `doc_replace_range`
- `doc_undo` / `doc_redo`
- `library_navigate`
- `library_rename` / `library_tag` / `library_create_folder`
- `mcp_health_check`
- `review_skill_safety` / `review_mcp_safety`
- `settings_update_timezone`
- `toggle_theme`
- `open_conversation`
