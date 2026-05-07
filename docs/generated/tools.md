# Tool Registry

> Auto-generated on 2026-04-06. Do not edit manually.
> Source: `src/lib/ai/tools/_metadata.ts`
> Regenerate: `pnpm tools:generate`

**43 tools** across 10 categories.

---

## Knowledge

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `search_context` | supabase | read | Search knowledge base for documents, meetings, notes. Call first before answering. |
| `get_document` | supabase | read | Fetch full document content by ID. Use when search result needs deeper reading. |
| `ingest_github_repo` | supabase | write | Import a GitHub repo into the context library. Clones, reads key files, saves as searchable context. |
| `ai_sdk_reference` | supabase | read | Look up Vercel AI SDK and AI Elements patterns for building AI-powered apps. |

## Agents

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `list_linear_issues` | linear | read | Query Linear issues with filters. For tasks, status checks, assignments. |
| `create_linear_issue` | linear | write | Create Linear issue. Routes through approval queue. |
| `query_granola` | granola | read | Search Granola meeting notes and transcripts. |
| `search_gmail` | gmail | read | Search Gmail. Syntax: from:, subject:, newer_than:, is:unread. |
| `draft_email` | gmail | write | Draft Gmail email. Routes through approval queue. |
| `search_notion` | notion | read | Search Notion pages and databases. |
| `list_drive_files` | drive | read | List and search Google Drive files. |
| `ask_linear_agent` | linear | read | Delegate to Linear specialist. Use for ALL task/issue requests. |
| `ask_gmail_agent` | gmail | read | Delegate to the Gmail specialist agent for email-related requests. |
| `ask_notion_agent` | notion | read | Delegate to the Notion specialist agent for page/database queries. |
| `ask_granola_agent` | granola | read | Delegate to the Granola specialist agent for meeting transcript queries. |
| `ask_drive_agent` | drive | read | Delegate to the Drive specialist agent for file search and reading. |
| `ask_user` | client | client-side | Ask the user structured questions via interactive form. Client-side tool. |

## Code

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `run_project` | sandbox | write | Create and run a multi-file project in a sandboxed VM. |
| `run_code` | sandbox | write | Execute a script in a sandboxed VM. For computations, data processing, API testing. |

## Documents

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `create_document` | supabase | write | Create a new rich-text document artifact. |
| `edit_document` | supabase | write | Edit an existing document or artifact. |

## Scheduling

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `schedule_action` | supabase | write | Schedule a recurring or one-time action. |
| `list_schedules` | supabase | read | List scheduled actions. |
| `edit_schedule` | supabase | write | Edit schedule: change name, timing, status (pause/resume). |
| `delete_schedule` | supabase | write | Delete a scheduled action permanently. |

## Web

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `web_browse` | web | read | Fetch a URL and extract text content. Use to read web pages, docs, articles. |
| `web_search` | perplexity | read | Search the web for current information via Perplexity Sonar. Returns results with source citations. |
| `weather` | web | read | Get the weather for a city. |

## Skills

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `activate_skill` | supabase | read | Activate a skill to load its specialized instructions and tools. |
| `create_skill` | supabase | write | Create a new custom skill for the agent. |
| `create_tool_from_code` | sandbox | write | Create a custom tool by generating and testing code in a sandbox. |
| `search_skills_marketplace` | web | read | Search the skills.sh marketplace for agent skills. |

## Compliance

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `review_compliance` | supabase | read | Review content against org rules and priority documents. |

## Artifacts

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `artifact_list` | supabase | read | List artifacts. Filter by type, search by title. |
| `artifact_get` | supabase | read | Get artifact content and open it in the artifact viewer. |
| `artifact_version` | supabase | read | List or restore artifact versions. |
| `artifact_panel` | client | client-side | Open or close the artifact side panel. Client-side tool. |
| `artifact_delete` | supabase | write | Delete an artifact. |
| `write_code` | supabase | write | Save a code file as an artifact with version history. |
| `edit_code` | supabase | write | Edit an existing code artifact using find/replace, creating a new version. |
| `express` | client | read | Generate animated dot pattern inline in chat. |

## Approvals

| Tool | Service | Access | Description |
|------|---------|--------|-------------|
| `list_approvals` | supabase | read | List pending approvals. |
| `propose_action` | supabase | write | Propose write action to external services for approval. |

