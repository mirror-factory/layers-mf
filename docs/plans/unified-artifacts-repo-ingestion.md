# Unified Artifacts & Repo Ingestion — Architecture Plan

> Linear: PROD-251 (Unified Artifacts), PROD-252 (Repo Ingestion)
> Status: Planning
> Date: 2026-03-31

---

## 1. Unified Artifact System

### Problem
Currently artifacts are scattered across different systems:
- Sandbox previews are ephemeral (die after 2 min)
- TipTap documents save to context_items
- Code blocks are just text in chat messages
- No version history across types
- No way to browse all artifacts

### Solution
One `artifacts` table with versioned state for everything.

### Database Schema

```sql
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('sandbox', 'document', 'code', 'csv', 'image', 'repo')),
  title TEXT NOT NULL,
  current_version INT NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  -- metadata examples:
  -- sandbox: { snapshotId, runCommand, exposePort, previewUrl, language }
  -- document: { wordCount, lastEditedBy }
  -- code: { language, filename }
  -- repo: { owner, repo, branch, lastCommit }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE artifact_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content TEXT, -- full content for docs/code, file list JSON for sandbox/repo
  snapshot_id TEXT, -- for sandbox artifacts
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, version)
);
```

### Artifact Panel Updates
- Version history sidebar in the artifact panel
- Click any version to view it
- "Restore" button to revert to a previous version
- Works for ALL types: sandbox, TipTap, code, CSV
- Diff view between versions (for code/text artifacts)

### Auto-Versioning
- TipTap auto-save creates a new version every 30s of inactivity
- Sandbox snapshot creates a new version after each run
- Code edits create versions on save
- Manual "Save Version" button available

---

## 2. GitHub Repo Ingestion

### Two Modes

#### Mode 1: Ingest into Context Library
```
/github ingest owner/repo
```

1. Use GitHub MCP `get_file_contents` to read key files
   - Or faster: `git clone` in sandbox, then read files
2. Filter: skip node_modules, .git, binary files, large files
3. Save each file as context_item:
   - source_type: "github-repo"
   - source_id: "owner/repo/path/to/file"
   - content_type: "file"
   - raw_content: file contents
4. Create embeddings for vector search
5. Now searchable: "search my layers-mf repo for the chat route"

#### Mode 2: Run in Sandbox
```
/github run owner/repo
```

1. Create sandbox with `HOST=0.0.0.0` env
2. `git clone https://PAT@github.com/owner/repo.git` (PAT from MCP server config)
3. Read package.json → detect framework (Next.js, Vite, Express, Python, etc.)
4. Read .env.example → use `ask_user` tool to prompt for each env var
5. Install dependencies: `npm install` or `pip install -r requirements.txt`
6. Start dev server: `npm run dev` or `python main.py`
7. Expose port → live preview URL
8. Save snapshot → can restart anytime
9. Create artifact with version 1

### Env Var Setup Flow
```
Granger reads .env.example:
  DATABASE_URL=
  STRIPE_SECRET_KEY=
  NEXT_PUBLIC_SITE_URL=

ask_user tool shows interview:
  ┌─────────────────────────────────┐
  │ Environment Variables           │
  │                                 │
  │ DATABASE_URL: [____________]    │
  │ STRIPE_SECRET_KEY: [________]  │
  │ NEXT_PUBLIC_SITE_URL: [_____]  │
  │                                 │
  │ [Skip] [Save & Run]            │
  └─────────────────────────────────┘

Env vars stored in sandbox snapshot.
On restart, env vars preserved.
```

### Tools to Build
- `ingest_repo(owner, repo, branch?)` — clones and ingests files to context library
- `run_repo(owner, repo, branch?, envVars?)` — clones, installs, runs in sandbox
- Both use GitHub PAT from `mcp_servers` table where name = "GitHub"

### Private Repo Access
The GitHub PAT stored in the MCP server config (`api_key_encrypted` column) is used for:
- `git clone` authentication
- Repo ingestion via GitHub MCP tools
- No additional setup needed — same token used for everything

---

## 3. Artifacts Page

### New Page: /artifacts
- Grid/list view of all artifacts across the org
- Filter by type (sandbox, document, code, repo)
- Search by title
- Click to open in artifact panel
- Version history visible on each card (e.g., "v3 - 2 hours ago")
- Quick actions: open, duplicate, delete, share

### Sidebar Nav
- Add "Artifacts" to MAIN_ITEMS with FileBox icon
- Shows badge with artifact count

---

## 4. Implementation Order

1. **DB migrations** — artifacts + artifact_versions tables
2. **Unified artifact API** — CRUD + versioning
3. **Update artifact panel** — version history sidebar
4. **Repo ingestion tool** — ingest_repo
5. **Run repo tool** — run_repo with env var interview
6. **Artifacts page** — browse all artifacts
7. **Auto-versioning** — TipTap, sandbox, code auto-save

---

## 5. How It All Connects

```
GitHub MCP (connected via PAT)
  ├── /github — slash command for issues, PRs, code search
  ├── /github ingest owner/repo — ingest files to Context Library
  └── /github run owner/repo — clone + run in sandbox
        ├── Reads .env.example → ask_user for env vars
        ├── npm install + npm run dev
        ├── Live preview URL
        ├── Snapshot saved
        └── Artifact created with version history
              ├── Version 1: initial clone
              ├── Version 2: after first edit
              ├── Version 3: after bug fix
              └── ... (scrollable in artifact panel)
```
