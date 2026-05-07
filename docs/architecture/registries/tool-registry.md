# Tool Registry

> Central reference for every tool available in Layers. Covers built-in tools, dynamically loaded MCP tools, and skill-activated tools.

---

## Overview

Layers exposes tools to the AI agent through three channels:

1. **Built-in tools** — defined in `src/lib/ai/tools.ts` via `createTools()`. Always available (subject to permissions).
2. **MCP tools** — loaded at runtime from connected MCP servers stored in the `mcp_servers` table.
3. **Skill tools** — injected when a skill is activated via `activate_skill`. Each skill declares which built-in tools it needs.

---

## Quick Reference Table

| # | Name | Category | Description | Client-side | Status |
|---|------|----------|-------------|:-----------:|--------|
| 1 | `search_context` | Knowledge | Search knowledge base for documents, meetings, notes | No | Active |
| 2 | `get_document` | Knowledge | Fetch full document content by ID | No | Active |
| 3 | `list_linear_issues` | Agents | Query Linear issues with filters | No | Active |
| 4 | `create_linear_issue` | Agents | Create Linear issue (routes through approval queue) | No | Active |
| 5 | `query_granola` | Agents | Search Granola meeting notes and transcripts | No | Active |
| 6 | `search_gmail` | Agents | Search Gmail with Gmail query syntax | No | Active |
| 7 | `draft_email` | Agents | Draft Gmail email (routes through approval queue) | No | Active |
| 8 | `search_notion` | Agents | Search Notion pages and databases | No | Active |
| 9 | `list_drive_files` | Agents | List and search Google Drive files | No | Active |
| 10 | `ask_linear_agent` | Agents | Delegate to Linear specialist sub-agent | No | Active |
| 11 | `ask_gmail_agent` | Agents | Delegate to Gmail specialist sub-agent | No | Active |
| 12 | `ask_notion_agent` | Agents | Delegate to Notion specialist sub-agent | No | Active |
| 13 | `ask_granola_agent` | Agents | Delegate to Granola specialist sub-agent | No | Active |
| 14 | `ask_drive_agent` | Agents | Delegate to Drive specialist sub-agent | No | Active |
| 15 | `schedule_action` | Scheduling | Schedule a recurring or one-time action | No | Active |
| 16 | `list_schedules` | Scheduling | List scheduled actions | No | Active |
| 17 | `edit_schedule` | Scheduling | Edit schedule: change name, timing, status | No | Active |
| 18 | `delete_schedule` | Scheduling | Delete a scheduled action permanently | No | Active |
| 19 | `run_project` | Code/Sandbox | Create and run a multi-file project in a sandboxed VM | No | Active |
| 20 | `run_code` | Code/Sandbox | Execute a script in a sandboxed VM | No | Active |
| 21 | `ingest_github_repo` | Knowledge | Import a GitHub repo into the context library | No | Active |
| 22 | `review_compliance` | Compliance | Review content against org rules and priority docs | No | Active |
| 23 | `artifact_list` | Artifacts | List artifacts, filter by type, search by title | No | Active |
| 24 | `artifact_get` | Artifacts | Get artifact content and open in viewer | No | Active |
| 25 | `artifact_version` | Artifacts | List or restore artifact versions | No | Active |
| 26 | `ai_sdk_reference` | Knowledge | Look up Vercel AI SDK patterns and code examples | No | Active |
| 27 | `artifact_panel` | Artifacts | Open or close the artifact side panel | Yes | Active |
| 28 | `artifact_delete` | Artifacts | Delete an artifact | No | Active |
| 29 | `express` | Artifacts | Generate animated dot pattern inline in chat | No | Active |
| 30 | `web_browse` | Web | Fetch a URL and extract text content | No | Active |
| 31 | `web_search` | Web | Search the web via Perplexity Sonar | No | Active |
| 32 | `write_code` | Artifacts | Save a code file as an artifact | No | Active |
| 33 | `edit_code` | Artifacts | Edit an existing code artifact (find/replace) | No | Active |
| 34 | `list_approvals` | Compliance | List pending approvals | No | Active |
| 35 | `propose_action` | Compliance | Propose write action to external services for approval | No | Active |
| 36 | `activate_skill` | Skills | Activate a skill to load its tools and instructions | No | Active |
| 37 | `create_document` | Documents | Create a new rich-text document artifact | No | Active |
| 38 | `edit_document` | Documents | Edit an existing document or artifact | No | Active |
| 39 | `ask_user` | Agents | Ask the user structured questions via interactive form | Yes | Active |
| 40 | `create_skill` | Skills | Create a new custom skill for the agent | No | Active |
| 41 | `create_tool_from_code` | Skills | Create a custom tool by generating and testing code in sandbox | No | Active |
| 42 | `search_skills_marketplace` | Skills | Search the skills.sh marketplace for agent skills | No | Active |

---

## Detailed Tool Definitions

### Knowledge

#### `search_context`
Search knowledge base for documents, meetings, notes. Called first before answering.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query |
| `limit` | number (1-20) | No | Maximum results |
| `filters.sourceType` | string | No | Filter by source type (e.g. upload, linear, gdrive) |
| `filters.contentType` | string | No | Filter by content type (e.g. document, meeting_transcript, issue) |

**Output:** Array of `{ id, title, source_type, content_type, rrf_score, trust_weight, days_ago, description_short, parent_content?, source_url?, source_created_at?, isArtifact?, artifactId? }`

---

#### `get_document`
Fetch full document content by ID. Use when search result needs deeper reading.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The document ID from search_context results |

**Output:** `{ title, content, source_type, content_type, source_url, source_created_at }` or `{ error }`

---

#### `ingest_github_repo`
Import a GitHub repo into the context library. Clones, reads key files, saves as searchable context.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo` | string | Yes | GitHub repo in owner/repo format |
| `branch` | string | No | Branch to clone, defaults to main |

**Output:** `{ repo, totalFiles, importedFiles, skippedFiles, files[] }`

---

#### `ai_sdk_reference`
Look up Vercel AI SDK and AI Elements patterns for building AI-powered apps.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | enum | Yes | One of: chat-client, chat-server, generate-text, generate-object, tools, streaming, sandbox-ai-app, embeddings, gateway |

**Output:** `{ description, code, notes }`

---

### Agents

#### `list_linear_issues`
Query Linear issues with filters.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | string | No | Filter by state (e.g. "In Progress", "Todo", "Done") |
| `assignee` | string | No | Filter by assignee name or "me" |
| `team` | string | No | Filter by team key (e.g. "PROD", "SERV") |
| `priority` | number | No | 1=Urgent, 2=High, 3=Medium, 4=Low |
| `limit` | number | No | Max results, default 20 |

**Output:** `{ issues: [{ id, title, status, assignee, priority, url }] }`

---

#### `create_linear_issue`
Create Linear issue. Routes through the approval queue.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Issue title |
| `team` | string | Yes | Team key (e.g. "PROD", "SERV") |
| `description` | string | No | Issue description |
| `priority` | number | No | Priority level |
| `assignee` | string | No | Assignee name |

**Output:** `{ message, approval_id }`

---

#### `query_granola`
Search Granola meeting notes and transcripts.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `since` | string | No | ISO date to search from |
| `limit` | number | No | Max meetings to return, default 10 |

**Output:** `{ meetings: [{ id, title, date }] }`

---

#### `search_gmail`
Search Gmail. Supports Gmail query syntax (from:, subject:, newer_than:, is:unread).

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Gmail search query |
| `limit` | number | No | Max results, default 10 |

**Output:** `{ emails: [{ id, subject, from, date, snippet }] }`

---

#### `draft_email`
Draft Gmail email. Routes through the approval queue.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | Yes | Recipient email |
| `subject` | string | Yes | Email subject |
| `body` | string | Yes | Email body |

**Output:** `{ message, approval_id }`

---

#### `search_notion`
Search Notion pages and databases.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search query text |
| `limit` | number | No | Max results, default 10 |

**Output:** `{ pages: [{ id, title, type }] }`

---

#### `list_drive_files`
List and search Google Drive files.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search query for file names |
| `limit` | number | No | Max results, default 20 |

**Output:** `{ files: [{ id, name, type, modified }] }`

---

#### `ask_linear_agent`
Delegate to Linear specialist sub-agent for all task/issue requests.

**Input:** `{ query: string }` | **Output:** `{ response, toolCalls }`

#### `ask_gmail_agent`
Delegate to Gmail specialist sub-agent for email-related requests.

**Input:** `{ query: string }` | **Output:** `{ response, toolCalls }`

#### `ask_notion_agent`
Delegate to Notion specialist sub-agent for page/database queries.

**Input:** `{ query: string }` | **Output:** `{ response, toolCalls }`

#### `ask_granola_agent`
Delegate to Granola specialist sub-agent for meeting transcript queries.

**Input:** `{ query: string }` | **Output:** `{ response, toolCalls }`

#### `ask_drive_agent`
Delegate to Drive specialist sub-agent for file search and reading.

**Input:** `{ query: string }` | **Output:** `{ response, toolCalls }`

#### `ask_user`
Ask the user structured questions via an interactive form. **Client-side tool (no execute).**

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Heading for the question panel |
| `description` | string | No | Context text shown below the title |
| `questions` | array | Yes | Array of question objects |
| `questions[].id` | string | Yes | Unique ID for the question |
| `questions[].label` | string | Yes | Question text shown to user |
| `questions[].type` | enum | Yes | "choice", "text", or "multiselect" |
| `questions[].options` | string[] | No | Options for choice/multiselect |
| `questions[].placeholder` | string | No | Placeholder for text inputs |
| `questions[].required` | boolean | No | Whether required (default true) |

**Output:** User responses are returned via `addToolOutput()` on the client.

---

### Code/Sandbox

#### `run_project`
Create and run a multi-file project in a sandboxed VM. Supports templates for React, Next.js, Vite, Python.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | enum | No | "none", "react", "nextjs", "vite", "python" |
| `files` | array | Yes | Array of `{ path, content }` |
| `add_files` | array | No | Additional files for incremental edits |
| `install_command` | string | No | e.g. "npm install recharts" |
| `run_command` | string | Yes | e.g. "npm run dev" |
| `read_output_files` | string[] | No | Paths of output files to read back |
| `expose_port` | number | No | Port to expose for preview (default 5173) |
| `description` | string | No | Description of the project |

**Output:** `{ stdout, stderr, exitCode, previewUrl, sandboxId, snapshotId, artifactId, files, success }`

---

#### `run_code`
Execute a script in a sandboxed VM. For computations, data processing, API testing.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | The code to execute |
| `language` | enum | Yes | "javascript", "typescript", "python" |
| `filename` | string | No | Filename, e.g. "analyze.js" |
| `packages` | string[] | No | npm/pip packages to install |
| `description` | string | No | What this code does |
| `expose_port` | number | No | Port to expose for live preview |

**Output:** `{ stdout, stderr, exitCode, previewUrl, success, language, filename, code }`

---

### Scheduling

#### `schedule_action`
Schedule a recurring or one-time action.

**Input schema:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Short name for the schedule |
| `description` | string | No | What this schedule does |
| `action_type` | enum | Yes | "query", "sync", "digest", "custom" |
| `target_service` | string | No | Target service (linear, gmail, granola, slack, notion) |
| `payload` | object | Yes | Action details (query text, filters, etc.) |
| `schedule` | string | Yes | Cron expression or "once:ISO_DATE" |
| `max_runs` | number | No | Max executions (1 for one-shot, omit for unlimited) |

**Output:** `{ message, id }`

---

#### `list_schedules`
**Input:** `{ status?: "active" | "paused" | "completed" | "all" }` | **Output:** `{ schedules[], total }`

#### `edit_schedule`
**Input:** `{ id, name?, description?, schedule?, status? }` | **Output:** `{ message, schedule }`

#### `delete_schedule`
**Input:** `{ id }` | **Output:** `{ message, deleted }`

---

### Web

#### `web_browse`
Fetch a URL and extract text content. Use to read web pages, docs, articles.

**Input:** `{ url: string }` | **Output:** `{ url, title, content, length }`

#### `web_search`
Search the web for current information via Perplexity Sonar. Returns results with source citations.

**Input:** `{ query: string }` | **Output:** `{ query, result, source, citations: [{ index, url }] }`

---

### Artifacts

#### `artifact_list`
**Input:** `{ type?: "code" | "document" | "sandbox", search?: string, limit?: number }` | **Output:** `{ artifacts[], count }`

#### `artifact_get`
**Input:** `{ artifactId: string }` | **Output:** `{ filename, language, code, type, artifactId, files?, previewUrl?, currentVersion, versionCount, description? }`

#### `artifact_version`
**Input:** `{ artifactId, action: "list" | "restore", versionNumber? }` | **Output:** `{ versions[] }` or version restore result

#### `artifact_panel`
Open or close the artifact side panel. **Client-side tool (no execute).**

**Input:** `{ action: "open" | "close", artifactId?: string }`

#### `artifact_delete`
**Input:** `{ artifactId: string }` | **Output:** `{ deleted, artifactId, message }`

#### `write_code`
Save a code file as an artifact with version history.

**Input:** `{ filename, language, code, description? }` | **Output:** `{ filename, language, code, artifactId, message }`

#### `edit_code`
Edit an existing code artifact using find/replace, creating a new version.

**Input:** `{ artifactId, targetText, replacement, editDescription?, filePath? }` | **Output:** `{ filename, language, code, artifactId, files?, currentVersion, previewUrl?, message }`

#### `express`
Generate animated dot pattern inline in chat.

**Input:** `{ concept: string, size?: number, dotCount?: number }` | **Output:** `{ type: "dot-expression", concept, points, size, dotCount }`

---

### Documents

#### `create_document`
Create a new rich-text document artifact (HTML format for TipTap editor).

**Input:** `{ title, content (HTML), description? }` | **Output:** `{ documentId, title, content, type: "document", artifactId, message }`

#### `edit_document`
Edit an existing document or artifact.

**Input:** `{ documentId, newTitle?, targetText?, replacement?, editDescription? }` | **Output:** `{ documentId, title, content, type: "document", editDescription?, message }`

---

### Compliance

#### `review_compliance`
Review content against org rules and priority documents. Uses Gemini Flash to evaluate each rule individually.

**Input:** `{ content: string, content_label?: string }` | **Output:** `{ type: "compliance-review", checks: [{ id, source, rule, status, explanation }], summary: { total, passed, failed, warnings, score } }`

#### `list_approvals`
**Input:** `{ status?: "pending" | "approved" | "rejected" | "all", limit? }` | **Output:** `{ items[], total }`

#### `propose_action`
Propose write action to external services for approval.

**Input:** `{ action_type, target_service, payload, reasoning, conflict_check? }` | **Output:** `{ message, approval_id }`

---

### Skills

#### `activate_skill`
Activate a skill to load its specialized instructions and tools.

**Input:** `{ skill_slug: string }` | **Output:** `{ activated, name, systemPrompt?, tools?, referenceFiles?, message }`

#### `create_skill`
Create a new custom skill.

**Input:** `{ name, slug, description, category, system_prompt, icon?, slash_command?, tools? }` | **Output:** `{ success, skill_id, name, slug, slash_command, message }`

#### `create_tool_from_code`
Create a custom tool by generating and testing code in a sandbox. Saves as a skill on success.

**Input:** `{ name, description, code, test_input, language?, packages? }` | **Output:** `{ success, testPassed, stdout, skill?, message }`

#### `search_skills_marketplace`
Search the skills.sh marketplace for agent skills.

**Input:** `{ query: string, limit?: number }` | **Output:** `{ query, count, totalAvailable, skills: [{ name, source, installs, installCommand, url }] }`

---

## MCP Tools (Dynamic)

MCP tools are loaded at runtime from servers stored in the `mcp_servers` database table. Each server exposes a set of tools discovered via the MCP protocol.

**How it works:**
1. User connects an MCP server via the `/mcp` page (URL + optional auth token).
2. Server connection details are saved to `mcp_servers` table.
3. At chat time, the agent loads connected MCP servers and calls `listTools()` on each.
4. Discovered tools are merged into the available tool set with server-specific prefixes.

**Common MCP servers:**
- GitHub (repos, PRs, issues, commits)
- Granola (meeting transcripts)
- Slack (channels, messages, threads)
- Linear (issues, projects, teams)
- Notion (pages, databases)

---

## Skill Tools (Dynamic)

When `activate_skill` is called, the activated skill declares which built-in tools it needs access to. The skill's `system_prompt` is injected and its `tools` array specifies allowed tool names.

**Flow:**
1. User triggers a slash command (e.g. `/pm`) or says "use the PM skill".
2. Agent calls `activate_skill({ skill_slug: "pm" })`.
3. The skill row is fetched from the `skills` table.
4. The skill's `system_prompt` and `reference_files` are appended to the agent's context.
5. The skill's `tools` array lists which built-in tools the skill can use.

---

## Permission System

Tool access is controlled by the `ToolPermissions` type:

```typescript
type ServicePermission = { read: boolean; write: boolean };

type ToolPermissions = {
  linear?: ServicePermission;
  gmail?: ServicePermission;
  notion?: ServicePermission;
  granola?: ServicePermission;
  drive?: ServicePermission;
};
```

Each tool is mapped to a service and access level via `TOOL_SERVICE_MAP`:

| Tool | Service | Access |
|------|---------|--------|
| `list_linear_issues` | linear | read |
| `create_linear_issue` | linear | write |
| `ask_linear_agent` | linear | read |
| `query_granola` | granola | read |
| `ask_granola_agent` | granola | read |
| `search_gmail` | gmail | read |
| `draft_email` | gmail | write |
| `ask_gmail_agent` | gmail | read |
| `search_notion` | notion | read |
| `ask_notion_agent` | notion | read |
| `list_drive_files` | drive | read |
| `ask_drive_agent` | drive | read |

Tools **not** in `TOOL_SERVICE_MAP` (e.g. `search_context`, `run_code`, `web_search`) are always available regardless of permissions.

The `applyPermissions()` function filters tools before they are passed to the agent: if a service's read or write permission is `false`, the corresponding tools are removed from the set.
