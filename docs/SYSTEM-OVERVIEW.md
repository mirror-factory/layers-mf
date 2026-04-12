# Layers MF / Granger --- System Overview

**Last updated:** April 12, 2026
**Version:** 0.7.1
**Repository:** `layers-mf`

---

## 1. Project Overview

### What is Layers MF / Granger?

Layers MF is an **AI-powered operating system for knowledge teams**. The product name visible to users is **Granger**. It provides:

- **Agentic chat** with 25+ tools for document search, code execution, artifact creation, scheduling, and MCP integrations
- **Portal experience** for external clients to receive, view, and interact with proposals/documents via AI and voice
- **Context library** with hybrid search (vector + BM25) across documents, meeting transcripts, issues, and integrations
- **Sessions** for collaborative knowledge work
- **MCP connectors** for third-party tool integration via OAuth
- **Skills system** for extensible AI capabilities
- **Scheduling and automation** via cron-based background jobs
- **Canvas** for visual knowledge mapping
- **Sandbox** for live code execution via Vercel Sandbox

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3, shadcn/ui, CSS variables |
| AI SDK | Vercel AI SDK v6 (`ai@6.0.116`) |
| AI Gateway | `@ai-sdk/gateway` --- single `AI_GATEWAY_API_KEY` for all providers |
| AI Providers | Anthropic (Claude), OpenAI (GPT), Google (Gemini) --- 9 models across 3 tiers |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Auth | Supabase Auth with SSR (`@supabase/ssr`) |
| Payments | Stripe |
| Email | Resend |
| Voice/TTS | Cartesia sonic-turbo (40ms first-byte latency) |
| Editor | Tiptap (rich text with AI assist) |
| PDF | PDF.js via `react-pdf`, `pdf-parse` |
| Sandbox | `@vercel/sandbox` (beta) |
| Mobile | Capacitor (iOS + Android) |
| Animations | Motion (Framer Motion), GSAP, Three.js |
| Background jobs | Inngest, croner |
| Integrations | Linear SDK, Notion client, Google APIs, Discord |
| Testing | Vitest (unit), Playwright (e2e) |
| Package manager | pnpm |
| CI/CD | Husky pre-commit hooks, Vercel deployment |

### Key URLs and Routes

| URL | Description |
|-----|-------------|
| `/` | Landing page (marketing) |
| `/login`, `/signup` | Authentication |
| `/chat` | Main Granger chat |
| `/chat/[id]` | Specific conversation |
| `/context` | Context library |
| `/context/[id]` | Context item detail |
| `/portal/[token]` | Portal viewer (client-facing) |
| `/connectors` | MCP server management |
| `/skills` | Skills editor |
| `/sessions` | Collaborative sessions |
| `/schedules` | Automated schedules |
| `/sandbox` | Code sandbox |
| `/canvas` | Visual knowledge canvas |
| `/canvas/[id]` | Specific canvas |
| `/analytics` | Analytics dashboard |
| `/analytics/costs` | AI cost tracking |
| `/settings` | User/org settings |
| `/overview` | System status overview |
| `/changelog` | Product changelog |
| `/admin` | Admin panel |
| `/inbox` | Notification inbox |
| `/artifacts` | Artifact browser |
| `/approvals` | Approval queue |
| `/tools` | Tool registry |
| `/docs` | Documentation browser |
| `/ditto` | Ditto voice/personality profile |
| `/agents` | Agent templates |
| `/sharing` | Shared items |
| `/notifications` | Notification center |
| `/priority` | Priority docs |
| `/issues` | Issue tracking |
| `/guide` | User guide |
| `/features` | Feature showcase |
| `/onboarding` | New user onboarding |

---

## 2. Architecture

### App Router Structure (`src/app/`)

```
src/app/
  (auth)/                   # Auth route group
    auth/callback/          # OAuth callback
    login/
    signup/
    forgot-password/
    reset-password/
  (dashboard)/              # Authenticated route group (shared layout with sidebar)
    actions/
    admin/
    agents/
    analytics/              # Costs, health sub-routes
    api-docs/
    approvals/
    artifacts/
    canvas/[id]/
    changelog/
    chat/[id]/
    connectors/
    context/[id]/
    context/upload-meeting/
    ditto/
    docs/[...slug]/
    entropy-showcase/
    features/use-cases/
    guide/
    home/
    how-it-works/
    inbox/
    integrations/
    issues/
    mcp/
    notifications/
    overview/
    priority/
    sandbox/
    schedules/
    sessions/
    settings/
    sharing/
    skills/
    tools/
  (marketing)/              # Public marketing pages
    pricing/
  (onboarding)/             # Onboarding flow
    onboarding/
  portal/                   # Portal (standalone layout, no dashboard sidebar)
    [token]/
  s/                        # Short links
  share/                    # Share pages
  hero-lab/                 # Hero/visual experiments
  sprint-progress/
  api/                      # API routes (see API Registry below)
```

### API Routes Registry

#### Chat & AI

| Path | Method | Description |
|------|--------|-------------|
| `/api/chat` | POST | Main agentic chat (ToolLoopAgent + 25+ tools) |
| `/api/chat/portal` | POST | Portal-specific chat (20+ document tools, intent detection) |
| `/api/chat/mcp` | POST | Lightweight MCP-only chat for connectors page |
| `/api/chat/session/[id]` | POST | Session-scoped chat |
| `/api/chat/skills` | POST | Skills-specific chat |
| `/api/chat/schedules` | POST | Schedule-specific chat |
| `/api/chat/branch` | POST | Branch a conversation |
| `/api/chat/history` | GET | Fetch chat message history |
| `/api/chat/context-stats` | GET | Token counts for system/rules/tools |
| `/api/chat/feedback` | POST | Message feedback (thumbs up/down) |
| `/api/chat/share` | POST | Share a conversation |
| `/api/chat/share-link` | POST | Generate share link |
| `/api/chat/stats` | GET | Chat usage statistics |
| `/api/tts` | POST | Cartesia TTS proxy (sonic-turbo) |

#### Context & Search

| Path | Method | Description |
|------|--------|-------------|
| `/api/context` | GET/POST | List/create context items |
| `/api/context/[id]` | GET/PATCH/DELETE | CRUD context item |
| `/api/context/[id]/versions` | GET | Version history |
| `/api/context/export` | GET | Export context items |
| `/api/context/bulk` | POST | Bulk operations |
| `/api/searches` | GET/POST | Saved searches |
| `/api/searches/[id]` | GET/PATCH/DELETE | Manage saved search |

#### MCP & Integrations

| Path | Method | Description |
|------|--------|-------------|
| `/api/mcp-servers` | GET/POST | List/add MCP servers |
| `/api/mcp-servers/[id]` | PATCH/DELETE | Update/remove MCP server |
| `/api/mcp/discover` | POST | Discover MCP OAuth from server URL |
| `/api/mcp/registry` | GET | Search curated + official + Smithery registries |
| `/api/mcp/oauth/callback` | GET | OAuth callback for MCP (public) |

#### Portal

| Path | Method | Description |
|------|--------|-------------|
| `/api/portals` | GET/POST | List/create portals |
| `/api/portals/[id]` | PATCH/DELETE | Manage portal |
| `/api/portals/public` | GET | Public portal access |
| `/api/portals/upload` | POST | Upload portal docs |

#### Sessions

| Path | Method | Description |
|------|--------|-------------|
| `/api/sessions` | GET/POST | List/create sessions |
| `/api/sessions/[id]` | GET/PATCH/DELETE | Manage session |
| `/api/sessions/[id]/context` | GET/POST | Session context items |
| `/api/sessions/[id]/insights` | GET/POST | Session insights |
| `/api/sessions/[id]/members` | GET/POST | Session members |

#### Skills

| Path | Method | Description |
|------|--------|-------------|
| `/api/skills` | GET/POST | List/create skills |
| `/api/skills/[id]` | PATCH/DELETE | Manage skill |
| `/api/skills/search` | GET | Search skills marketplace |
| `/api/skills/seed` | POST | Seed default skills |
| `/api/skills/upload` | POST | Upload skill file |

#### Artifacts & Sandbox

| Path | Method | Description |
|------|--------|-------------|
| `/api/artifacts` | GET/POST | List/create artifacts |
| `/api/artifacts/[id]` | GET/PATCH/DELETE | Manage artifact |
| `/api/artifacts/[id]/versions` | GET | Artifact versions |
| `/api/artifacts/[id]/versions/[versionNumber]` | GET | Specific version |
| `/api/sandbox/[artifactId]` | POST | Run artifact in sandbox |
| `/api/sandbox/restart` | POST | Restart sandbox |
| `/api/sandbox/status` | GET | Sandbox status |
| `/api/sandbox/demo` | POST | Demo sandbox |

#### Scheduling & Automation

| Path | Method | Description |
|------|--------|-------------|
| `/api/schedules` | GET/POST | List/create schedules |
| `/api/schedules/[id]` | PATCH/DELETE | Manage schedule |
| `/api/schedules/execute` | POST | Manually execute schedule |

#### Agents

| Path | Method | Description |
|------|--------|-------------|
| `/api/agents/templates` | GET/POST | Agent templates |
| `/api/agents/run` | POST | Run an agent |

#### Analytics

| Path | Method | Description |
|------|--------|-------------|
| `/api/analytics/costs` | GET | AI costs by model/user/date |
| `/api/analytics/usage` | GET | Usage metrics |
| `/api/analytics/content-health` | GET | Content health scores |
| `/api/analytics/sandbox-costs` | GET | Sandbox usage costs |
| `/api/analytics/webhook-health` | GET | Webhook delivery health |

#### Settings

| Path | Method | Description |
|------|--------|-------------|
| `/api/settings/org` | GET/PATCH | Organization settings |
| `/api/settings/api-keys` | GET/POST/DELETE | API key management |
| `/api/settings/credentials` | GET/POST | Credential storage |
| `/api/settings/notifications` | GET/PATCH | Notification preferences |
| `/api/settings/partner` | GET/PATCH | Partner settings |
| `/api/settings/permissions` | GET/PATCH | Permission settings |
| `/api/settings/source-weights` | GET/PATCH | Source trust weights |

#### Team

| Path | Method | Description |
|------|--------|-------------|
| `/api/team/members` | GET | List team members |
| `/api/team/invite` | POST | Send invite |
| `/api/team/invite/[id]` | PATCH/DELETE | Manage invite |
| `/api/team/profile` | GET/PATCH | User profile |

#### Billing

| Path | Method | Description |
|------|--------|-------------|
| `/api/billing/checkout` | POST | Create Stripe checkout |
| `/api/billing/subscription` | GET/PATCH | Manage subscription |
| `/api/billing/credits` | GET | Credit balance |
| `/api/billing/usage` | GET | Billing usage |

#### Other Routes

| Path | Method | Description |
|------|--------|-------------|
| `/api/approval` | GET/POST | List/create approvals |
| `/api/approval/[id]` | PATCH | Update approval |
| `/api/audit` | GET | Audit log |
| `/api/canvases` | GET/POST | Canvas CRUD |
| `/api/canvases/[id]` | PATCH/DELETE | Manage canvas |
| `/api/collections` | GET/POST | Collections |
| `/api/conversations` | GET/POST | Conversations |
| `/api/conversations/[id]` | GET/PATCH/DELETE | Manage conversation |
| `/api/ditto/profile` | GET/POST | Ditto voice profile |
| `/api/ditto/suggestions` | GET | Ditto suggestions |
| `/api/docs` | GET | Documentation |
| `/api/documents` | GET/POST | Documents |
| `/api/edit-proposals` | GET/POST | Edit proposals |
| `/api/generate` | POST | AI generation |
| `/api/health` | GET | Health check |
| `/api/inbox` | GET/POST | Inbox items |
| `/api/inbox/generate` | POST | Generate inbox item |
| `/api/ingest/upload` | POST | File upload + ingestion |
| `/api/interactions` | POST | Track interactions |
| `/api/link-preview` | GET | URL link preview |
| `/api/notifications` | GET/POST | Notifications |
| `/api/org` | GET/PATCH | Organization |
| `/api/priority-docs` | GET/POST/PATCH/DELETE | Priority doc management |
| `/api/push/send` | POST | Push notifications |
| `/api/rules` | GET/POST/PATCH/DELETE | Rules management |
| `/api/scaffolding/apply` | POST | Apply scaffolding template |
| `/api/share-link` | POST | Create share link |
| `/api/share-link/[token]` | GET | Resolve share link |
| `/api/sharing` | GET/POST | Sharing management |
| `/api/sharing/[id]` | PATCH/DELETE | Manage shared item |
| `/api/tags` | GET/POST | Tag management |
| `/api/tags/[id]` | PATCH/DELETE | Manage tag |
| `/api/tools/registry` | GET | Tool registry |

#### Cron Jobs

| Path | Description |
|------|-------------|
| `/api/cron/digest` | Morning digest generation |
| `/api/cron/synthesis` | Nightly 30-day synthesis |
| `/api/cron/execute-schedules` | Run due schedules |
| `/api/cron/classify` | Content classification |
| `/api/cron/credit-reset` | Monthly credit reset |
| `/api/cron/discord-alerts` | Discord alert delivery |

#### Webhooks

| Path | Description |
|------|-------------|
| `/api/webhooks/stripe` | Stripe payment events |
| `/api/webhooks/linear` | Linear issue updates |
| `/api/webhooks/discord` | Discord interaction handler |
| `/api/webhooks/ingest` | Generic ingest webhook |

#### Inngest

| Path | Description |
|------|-------------|
| `/api/inngest` | Inngest function handler (background jobs) |

### Component Registry

#### Core Application Components (88+ total)

| Name | Location | Description |
|------|----------|-------------|
| ChatInterface | `src/components/chat-interface.tsx` | Full agentic chat with tools, context, artifacts, ChatVariant system |
| TiptapEditor | `src/components/tiptap-editor.tsx` | Rich text editor with AI assist |
| ContextLibrary | `src/components/context-library.tsx` | Folder-based context browser |
| SidebarNav | `src/components/sidebar-nav.tsx` | Main sidebar navigation |
| ConnectorsView | `src/components/connectors-view.tsx` | MCP server management (connect/disconnect/remove) |
| MCPServerCard | `src/components/mcp-server-card.tsx` | MCP connection card with PKCE OAuth |
| MCPChat | `src/components/mcp-chat.tsx` | Mini chat for MCP discovery |
| MCPConnectCards | `src/components/mcp-connect-cards.tsx` | Inline OAuth + bearer token cards |
| SkillsEditor | `src/components/skills-editor.tsx` | Manage skills with editor |
| InterviewUI | `src/components/interview-ui.tsx` | `ask_user` tool interview form |
| CodeSandbox | `src/components/code-sandbox.tsx` | Live code execution sandbox |
| OverviewPage | `src/components/overview-page.tsx` | System status overview |
| ChangelogPage | `src/components/changelog-page.tsx` | Product changelog |
| CommandPalette | `src/components/command-palette.tsx` | Cmd+K command palette |
| InboxList | `src/components/inbox-list.tsx` | Notification inbox |
| ScheduleList | `src/components/schedule-list.tsx` | Schedule management |
| SessionsList | `src/components/sessions-list.tsx` | Sessions browser |
| SessionWorkspace | `src/components/session-workspace.tsx` | Session detail workspace |
| ContentViewer | `src/components/content-viewer.tsx` | Document content viewer |
| DocumentEditor | `src/components/document-editor.tsx` | Document editing |
| ContextUploader | `src/components/context-uploader.tsx` | File upload for context |
| ArtifactDetailView | `src/components/artifact-detail-view.tsx` | Artifact detail + versions |
| ToolRegistryPage | `src/components/tool-registry-page.tsx` | Tool registry browser |
| NotificationBell | `src/components/notification-bell.tsx` | Header notification bell |
| ShareDialog | `src/components/share-dialog.tsx` | Share content dialog |
| OrgDashboard | `src/components/org-dashboard.tsx` | Organization dashboard |
| TeamManagement | `src/components/team-management.tsx` | Team member management |
| DittoProfile | `src/components/ditto-profile.tsx` | Ditto personality profile |
| LandingPage | `src/components/landing-page.tsx` | Marketing landing page |
| HomeHero | `src/components/home-hero.tsx` | Dashboard home hero |
| ExportDropdown | `src/components/export-dropdown.tsx` | Export options |
| TagManager | `src/components/tag-manager.tsx` | Tag management |
| LibraryShell | `src/components/library-shell.tsx` | Context library shell |
| LibraryFilters | `src/components/library-filters.tsx` | Library filter controls |
| ApprovalQueue | `src/components/approval-queue.tsx` | Approval workflow queue |
| EditProposalQueue | `src/components/edit-proposal-queue.tsx` | Edit proposals |
| SavedSearches | `src/components/saved-searches.tsx` | Saved search management |

#### Portal Components

| Name | Location | Description |
|------|----------|-------------|
| PortalViewer | `src/components/portal-viewer.tsx` | Main portal shell (~2000 lines) |
| PortalPdfViewer | `src/components/portal-pdf-viewer.tsx` | PDF rendering with text layer, highlight, search |
| PortalVoiceMode | `src/components/portal-voice-mode.tsx` | Voice STT/TTS with waveform UI |
| PortalSplash | `src/components/portal-splash.tsx` | Configurable splash/loading screen |
| PortalOnboarding | `src/components/portal-onboarding.tsx` | 3-step tutorial (Browse/Ask/Talk) |
| PortalWelcomeModal | `src/components/portal-welcome-modal.tsx` | Welcome overlay |
| PortalAnnotationOverlay | `src/components/portal-annotation-overlay.tsx` | Sticky annotations on PDF |
| PortalChat | `src/components/portal-chat.tsx` | Portal chat wrapper |
| PortalExperience | `src/components/portal-experience.tsx` | Portal experience wrapper |
| PortalRichContent | `src/components/portal-rich-content.tsx` | Rich content rendering |

#### Chat Sub-components (`src/components/chat/`)

| Name | Description |
|------|-------------|
| ContextWindowBar | Token counter + context visualization |
| MessageStats | Message statistics display |
| SourceBadge | Source attribution badge |
| SourceCitation | Source citation card |

#### AI Elements (`src/components/ai-elements/`)

Installed from `@ai-elements`:

| Name | Description |
|------|-------------|
| Conversation | Chat conversation container with scroll |
| PromptInput | Chat input with textarea and submit |
| Suggestion | Suggestion chip/button |
| Shimmer | Animated loading shimmer |
| Reasoning | Expandable reasoning display |
| Sources | Citation source cards |
| Message | UIMessage renderer with Markdown |
| Tool | Tool call display with status |
| CodeBlock | Code syntax highlighting |

#### Canvas Components (`src/components/canvas/`)

| Name | Description |
|------|-------------|
| CanvasWorkspace | Main canvas editor |
| CanvasItemCard | Individual canvas item |
| CanvasConnections | Connection lines between items |
| CanvasToolbar | Canvas editing toolbar |
| CanvasMinimap | Minimap navigation |
| CanvasList | Canvas listing |
| AddItemDialog | Add item to canvas |

#### shadcn/ui Components (`src/components/ui/`, 43 files)

Accordion, AlertDialog, Badge, Breadcrumb, Button, ButtonGroup, Card, Checkbox, Collapsible, Command, ContextMenu, Dialog, DropdownMenu, HoverCard, Input, InputGroup, Label, Popover, Progress, ScrollArea, Select, Separator, Sheet, Skeleton, Slider, Sonner, Switch, Tabs, Textarea, Tooltip, Spinner, and custom visual components (AgentSwarm, AIHeroBackground, DitheringShader, Entropy, GradientWave, HeroDitheringCard, NeuralDots, NeuralMorph, PixelCanvas, Sphere, WaveSidebar, ImageLoading).

### Database (Supabase PostgreSQL)

Key tables (based on API routes and lib code):

| Table | Purpose |
|-------|---------|
| `context_items` | Documents, transcripts, issues with org_id, source_type, source_id, embeddings |
| `chat_messages` | Persisted chat messages |
| `conversations` | Chat conversations |
| `sessions` | Collaborative sessions |
| `session_members` | Session membership |
| `session_context` | Session-scoped context |
| `artifacts` | Code/document artifacts |
| `artifact_versions` | Artifact version history |
| `skills` | User/org skills |
| `schedules` | Automated schedules with cron expressions |
| `approvals` | Approval workflow items |
| `mcp_servers` | Connected MCP servers |
| `rules` | Organization rules |
| `priority_docs` | Priority document configuration |
| `canvases` | Canvas boards |
| `tags` | Tagging system |
| `searches` | Saved searches |
| `share_links` | Public share links |
| `portals` | Portal configurations |
| `organizations` | Multi-tenant orgs |
| `profiles` | User profiles |
| `team_invites` | Team invitations |
| `api_keys` | API key management |
| `audit_log` | Audit trail |
| `interactions` | User interaction tracking |
| `notifications` | Notification records |
| `ai_usage` | AI cost tracking per model/user |
| `credits` | Credit balance |
| `subscriptions` | Stripe subscription state |

Key RPCs:
- `search_context_items` --- hybrid search (vector + BM25/RRF) when embeddings available
- `search_context_items_text` --- text-only search fallback

Partial unique index on `context_items(org_id, source_type, source_id) WHERE source_id IS NOT NULL` --- requires select-then-insert pattern (not upsert).

### AI Providers (via AI Gateway)

All AI calls route through **Vercel AI Gateway** with a single `AI_GATEWAY_API_KEY`. No per-provider keys needed.

**Model Matrix (9 models, 3 providers x 3 tiers):**

| Tier | Anthropic | OpenAI | Google |
|------|-----------|--------|--------|
| Flagship | `anthropic/claude-opus-4.6` | `openai/gpt-5.4` | `google/gemini-3.1-pro-preview` |
| Balanced | `anthropic/claude-sonnet-4.6` | `openai/gpt-5.4-mini` | `google/gemini-3-flash` |
| Fast | `anthropic/claude-haiku-4.5` | `openai/gpt-5-nano` | `google/gemini-3.1-flash-lite-preview` |

**Task-to-model defaults:**

| Task | Model |
|------|-------|
| Chat | `anthropic/claude-sonnet-4.6` |
| Extraction | `anthropic/claude-sonnet-4.6` |
| Classification | `anthropic/claude-haiku-4.5` |
| Digest | `anthropic/claude-sonnet-4.6` |
| Compaction | `anthropic/claude-haiku-4.5` |
| Synthesis | `anthropic/claude-opus-4.6` |
| Embedding | `openai/text-embedding-3-small` (1536-dim) |

---

## 3. Feature Map

| Feature | Status | Route/Location | Description |
|---------|--------|----------------|-------------|
| **Granger Chat** | Active | `/chat`, `/api/chat` | Main agentic chat with ToolLoopAgent, 25+ tools, model selector, context panel |
| **Portal Viewer** | Active (v0.7.0) | `/portal/[token]`, `/api/chat/portal` | AI-powered document viewer for clients with 20+ tools, voice, highlights |
| **Context Library** | Active | `/context`, `/api/context` | Folder-based document browser with hybrid search, upload, versioning |
| **MCP Connectors** | Active | `/connectors`, `/api/mcp-servers` | Connect third-party tools via MCP with OAuth/PKCE |
| **Skills System** | Active | `/skills`, `/api/skills` | Create, edit, activate skills with marketplace search |
| **Sessions** | Active | `/sessions`, `/api/sessions` | Collaborative knowledge sessions with context and insights |
| **Schedules** | Active | `/schedules`, `/api/schedules` | Cron-based automated AI tasks |
| **Sandbox** | Active (beta) | `/sandbox`, `/api/sandbox` | Vercel Sandbox for live code execution |
| **Artifacts** | Active | `/artifacts`, `/api/artifacts` | Code and document artifacts with version history |
| **Canvas** | Active | `/canvas`, `/api/canvases` | Visual knowledge mapping with connections |
| **Approvals** | Active | `/approvals`, `/api/approval` | Approval workflow for AI-proposed actions |
| **Analytics** | Active | `/analytics`, `/api/analytics` | AI costs, usage, content health, webhook health |
| **Inbox** | Active | `/inbox`, `/api/inbox` | Notification inbox with AI-generated summaries |
| **Tool Registry** | Active | `/tools`, `/api/tools/registry` | Browse available AI tools |
| **Agent Templates** | Active | `/agents`, `/api/agents` | Pre-built agent configurations |
| **Ditto** | Active | `/ditto`, `/api/ditto` | Voice/personality profile for AI |
| **Billing** | Active | `/settings`, `/api/billing` | Stripe subscriptions, credits, usage |
| **Team Management** | Active | `/settings`, `/api/team` | Invite members, manage roles |
| **Notifications** | Active | `/notifications`, `/api/notifications` | Push notifications (Capacitor), in-app |
| **Sharing** | Active | `/sharing`, `/api/sharing` | Share conversations, context, artifacts |
| **Documentation** | Active | `/docs`, `/api/docs` | In-app doc browser |
| **Admin** | Active | `/admin`, `/api/admin` | Admin config and stats |
| **Onboarding** | Active | `/onboarding` | New user onboarding flow |
| **Priority Docs** | Active | `/priority`, `/api/priority-docs` | Priority document management |
| **Rules** | Active | Settings, `/api/rules` | Organization rules for AI behavior |
| **Audit Log** | Active | `/api/audit` | Activity audit trail |
| **Search** | Active | `/api/searches` | Saved searches with hybrid retrieval |
| **Tags** | Active | `/api/tags` | Content tagging system |
| **Discord Bot** | Active | `/api/webhooks/discord`, `/api/discord` | Discord chat adapter |
| **Mobile** | In progress | Capacitor config | iOS + Android via Capacitor |
| **Edit Proposals** | Active | `/api/edit-proposals` | Propose edits to documents |
| **Cron Jobs** | Active | `/api/cron/*` | Digest, synthesis, scheduling, classification, credit reset |
| **Webhooks** | Active | `/api/webhooks/*` | Stripe, Linear, Discord, ingest |

---

## 4. Portal Experience (Detailed)

### Overview

The Portal (`/portal/[token]`) is an AI-powered document collaboration experience for external clients. A sender creates a portal with documents, and recipients access it via a unique token URL.

**Demo URL:** `http://localhost:3000/portal/bluewave-demo`

### Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Document Rendering | PDF.js via react-pdf | All docs (DOCX, XLSX, PDF) converted to PDF via LibreOffice |
| Chat | ChatInterface with ChatVariant config | Reusable, typed config for styling/behavior |
| Voice | Browser STT + Cartesia sonic-turbo TTS | 40ms first-byte latency, barge-in support |
| AI Model | Gemini 3.0 Flash (production) | Via Vercel AI Gateway |
| Tools | 20+ AI tools | Highlight, navigate, chart, walkthrough, bookmark, compare, brief |
| Splash | PortalSplash | Configurable logo, branding, subtitle, colors |

### Everything is PDF

All DOCX and XLSX files are pre-converted to PDF using LibreOffice headless (`scripts/convert-docs-to-pdf.ts`). This means:
- One renderer for all doc types (PortalPdfViewer)
- Highlight, scroll, annotate work identically on everything
- Text layer search is consistent
- No separate renderers needed for viewing

### ChatVariant System

The chat component accepts a `variant` prop with typed config:

```typescript
interface ChatVariant {
  style: "default" | "portal";
  headingColor, bodyColor, mutedColor: string;
  inputBorder, inputBg: string;
  gradientFrom, gradientTo: string;
  suggestions: { text: string; accent: boolean }[];
  voiceEnabled: boolean;
  tools: string[];
}
```

Exported variants: `PORTAL_VARIANT`, `DEFAULT_VARIANT`.

### Intent Detection

Server-side keyword matching narrows available tools per message to prevent the model from looping with too many tool choices:

```
"highlight budget"  -> only highlight_text + switch_document
"chart the phases"  -> only render_chart
"walk me through"   -> only walkthrough_document
```

### Voice Mode

- **STT:** Browser native `webkitSpeechRecognition` (free, instant)
- **TTS:** Cartesia sonic-turbo via `/api/tts` route (40ms first-byte)
- **Voice ID:** Jillian - Happy Spirit
- **Barge-in:** Recognition restarts during TTS, stops audio on speech
- **UI:** Compact waveform bars flanking mic button

### Portal UI Components

| Component | File | Purpose |
|-----------|------|---------|
| PortalViewer | `portal-viewer.tsx` | Main portal shell (~2000 lines) |
| PortalPdfViewer | `portal-pdf-viewer.tsx` | PDF rendering with text layer |
| PortalVoiceMode | `portal-voice-mode.tsx` | Voice STT/TTS with waveform UI |
| PortalSplash | `portal-splash.tsx` | Configurable splash/loading screen |
| PortalOnboarding | `portal-onboarding.tsx` | 3-step tutorial (Browse/Ask/Talk) |
| PortalWelcomeModal | `portal-welcome-modal.tsx` | Welcome overlay with features |
| PortalAnnotationOverlay | `portal-annotation-overlay.tsx` | Sticky annotations on current page |

### Verified Features (via Expect)

Splash branding, 3-step onboarding, document library as default view, dark/light mode, corner + sidebar chat, voice mode activation, highlight on PDF, switch_document, navigate_pdf, render_chart, library tabs, XLSX rendering, DOCX as PDF, two-column spread, bubble menu, mobile responsive, multi-message chat, reading progress bar, quick actions.

---

## 5. AI Tools Registry

### Main Chat Tools (`/api/chat` --- `src/lib/ai/tools.ts`)

| Tool | Description |
|------|-------------|
| `search_context` | Hybrid search across context library (vector + BM25) |
| `get_document` | Fetch full document content by ID |
| `schedule_action` | Create a scheduled AI task with cron expression |
| `list_schedules` | List existing schedules |
| `edit_schedule` | Update a schedule |
| `delete_schedule` | Remove a schedule |
| `run_project` | Multi-file project execution in sandbox |
| `run_code` | Single-file code execution in sandbox |
| `ingest_github_repo` | Ingest a GitHub repository into context |
| `review_compliance` | Review document for compliance issues |
| `artifact_list` | List existing artifacts |
| `artifact_get` | Fetch artifact content |
| `artifact_version` | Create new artifact version |
| `artifact_panel` | Control artifact panel visibility (client-side) |
| `artifact_delete` | Delete an artifact |
| `express` | Generate visual dot art expressions |
| `web_browse` | Browse a URL and extract content |
| `write_code` | Create a code artifact |
| `edit_code` | Edit existing code artifact |
| `list_approvals` | Query approval queue |
| `propose_action` | Propose an action for approval |
| `web_search` | Search the web |
| `activate_skill` | Activate a skill |
| `create_document` | Create a document artifact |
| `edit_document` | Edit a document artifact |
| `ask_user` | Interview form to gather user input |
| `create_skill` | Create a new skill |
| `create_tool_from_code` | Create tool via sandbox execution |
| `search_skills_marketplace` | Search skills.sh marketplace |
| `search_mcp_servers` | Search MCP server registry |
| `connect_mcp_server` | Connect an MCP server |
| `disconnect_mcp_server` | Disconnect an MCP server |
| `list_mcp_servers` | List connected MCP servers |
| `ai_sdk_reference` | Fetch AI SDK reference docs for building AI apps |
| `weather` | Weather lookup (demo) |

### Portal Chat Tools (`/api/chat/portal`)

| Tool | Category | Description |
|------|----------|-------------|
| `switch_document` | Navigation | Switch between portal documents |
| `navigate_pdf` | Navigation | Go to specific page number |
| `open_document_preview` | Navigation | Open library doc as tab |
| `navigate_portal` | Navigation | Navigate to sections/tabs |
| `highlight_text` | Content | Highlight text with yellow overlay + auto-scroll |
| `add_annotation` | Content | Visual callouts on PDF |
| `capture_screen` | Content | Flash animation on document region |
| `search_document` | Content | Keyword search in document |
| `get_page_content` | Content | Read page text content |
| `summarize_section` | Content | Summarize page range |
| `render_chart` | Visualization | Chart.js charts in chat |
| `walkthrough_document` | Visualization | Animated section-by-section tour |
| `get_document_registry` | Library | List all library docs |
| `lookup_document` | Library | Read doc content by ID |
| `compare_documents` | Library | Side-by-side comparison |
| `list_documents` | Library | List portal docs |
| `save_bookmark` | User Actions | Persistent bookmarks with annotations |
| `share_feedback` | User Actions | Compile viewer feedback |
| `generate_brief` | User Actions | Executive summary |
| `track_reading` | User Actions | Reading progress + unread sections |
| `web_search` | User Actions | Perplexity search |

---

## 6. Testing Status

### Unit Tests (Vitest)

**66 test files** found across the codebase:

**API route tests (40 files):**
- Chat: `route.test.ts`, `history`, `feedback`, `session/[id]`
- Context: `[id]`, `versions`, `export`, `bulk`
- Sessions: main, `[id]`, context, insights, members
- Settings: org, api-keys, notifications
- Team: members, invite, invite/[id], profile
- Billing: checkout, credits, subscription
- Webhooks: stripe, linear, discord, ingest
- Auth: callback, password-validation
- Canvases, conversations, searches, actions, agents/templates
- Ditto: profile, suggestions
- Inbox: generate
- Health, interactions, ingest/upload

**Library tests (26 files):**
- `src/lib/__tests__/`: compound-loop, credits, export, versioning, webhook-dedup, content-lifecycle
- `src/lib/ai/__tests__/`: cross-source, query-expansion, usage
- `src/lib/ai/tools.test.ts`
- `src/lib/db/search.test.ts`
- `src/lib/audit.test.ts`, `rate-limit.test.ts`, `utils.test.ts`
- `src/lib/ditto/__tests__/profile.test.ts`
- `src/lib/email/__tests__/digest.test.ts`
- `src/lib/integrations/granola.test.ts`, `message-windows.test.ts`
- `src/lib/pipeline/__tests__/chunker.test.ts`
- `src/lib/inngest/functions/__tests__/session-agent.test.ts`
- `src/lib/inbox/generate.test.ts`
- `src/lib/kpi/compute.test.ts`

### AI Evals (Vitest)

| Eval | File | Description |
|------|------|-------------|
| Retrieval | `retrieval.eval.ts` | Search quality scoring |
| Agent | `agent.eval.ts` | Agent tool selection accuracy |
| Context Health | `context-health.eval.ts` | Content freshness and quality |
| Extraction | `extraction.eval.ts` | Entity extraction accuracy |
| Performance | `performance.eval.ts` | Latency benchmarks |
| Extraction Scoring | `extraction-scoring.test.ts` | Scoring utilities |

### E2E Tests (Playwright)

**24 spec files** in `e2e/`:

`agents`, `api`, `auth`, `billing`, `canvas`, `chat`, `context-library`, `dashboard`, `ditto`, `full-flow`, `inbox-actions`, `integrations`, `landing`, `marketing`, `onboarding`, `portal`, `production-smoke`, `sessions`, `settings` (3 files), `smoke-drive-chat`

### Testing Gaps

- ~~**Portal chat route** --- no test file for `/api/chat/portal/route.ts`~~ **COVERED (v0.7.1)** --- 50 tests (validation, intent detection, helpers)
- ~~**Portal tools** --- intent detection system has no test coverage~~ **COVERED (v0.7.1)** --- 26 intent detection tests across 5 categories
- **Portal components** --- no unit tests for PortalViewer, PortalPdfViewer, PortalVoiceMode, or any portal component
- **ChatInterface** --- no component tests for the main chat UI
- **AI Elements** --- no tests for the installed AI Elements components (size props verified correct)
- **Canvas components** --- no unit tests
- **Voice/TTS** --- no tests for `/api/tts` or voice mode logic
- **MCP tools** --- limited testing of MCP connection flow
- **Skills marketplace** --- no integration tests
- **Cron jobs** --- no tests for cron routes

### Recommended Testing Strategy

1. **Unit tests** for all portal tools (intent detection, tool selection)
2. **Component tests** for ChatInterface and PortalViewer using Testing Library
3. **E2E portal flow** via Playwright across 4 screen sizes (desktop, tablet, mobile portrait, mobile landscape)
4. **AI eval suite** for portal tool accuracy (does highlight_text highlight the right passage?)
5. **Snapshot tests** for AI Elements rendering
6. **Integration tests** for MCP connection lifecycle (discover -> OAuth -> connect -> use -> disconnect)

---

## 7. Known Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Voice listening | Medium | Simplified state flow pushed; needs browser testing end-to-end |
| Voice TTS response | Medium | Cartesia wired, needs browser testing alongside STT |
| ~~Highlight after doc switch~~ | **Fixed (v0.7.1)** | pdfControls reset on doc switch; useEffect guard applies pending highlights when PDF loads |
| ~~DOCX dark mode text~~ | **Fixed (v0.7.1)** | Forced dark text (#1e293b) on white DOCX pages via CSS |
| CLS > 0.1 | Cosmetic | Layout shifts from splash/PDF loading (0.11--0.15, down from 0.94) |
| AI Elements `size` props | Minor | `message.tsx` uses `size="icon-sm"` (not in our Button), `code-block.tsx` passes `size="sm"` to SelectTrigger (not supported) |
| ~~Flash Lite tool looping~~ | **Mitigated (v0.7.1)** | Upgraded to Gemini 3.0 Flash; intent detection still active as safety net |
| Partial unique index | Architectural | `context_items` partial index requires select-then-insert pattern, not upsert |

---

## 8. Environment Setup

### Required Environment Variables

```bash
# AI Gateway (REQUIRED --- all AI calls route through this)
AI_GATEWAY_API_KEY=

# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe (for billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Cartesia (for portal voice/TTS)
CARTESIA_API_KEY=

# Resend (for email)
RESEND_API_KEY=

# Linear (for issue tracking integration)
LINEAR_API_KEY=
LINEAR_WEBHOOK_SECRET=

# Discord (for bot)
DISCORD_APPLICATION_ID=
DISCORD_PUBLIC_KEY=
DISCORD_BOT_TOKEN=

# Inngest (for background jobs)
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=

# Vercel Sandbox (beta)
VERCEL_SANDBOX_API_KEY=
```

### External Services

| Service | Purpose | Required? |
|---------|---------|-----------|
| Supabase | Database, auth, storage | Yes |
| Vercel AI Gateway | All AI model access (single key) | Yes |
| Stripe | Billing, subscriptions | For billing features |
| Cartesia | TTS voice synthesis | For portal voice |
| Resend | Transactional email | For email features |
| Linear | Issue tracking | For Linear integration |
| Discord | Chat bot | For Discord integration |
| Inngest | Background jobs | For async processing |
| Vercel Sandbox | Code execution | For sandbox feature |
| LibreOffice | DOCX/XLSX to PDF conversion | For portal (local install) |

### Local Setup

```bash
# Install LibreOffice for doc conversion
brew install --cask libreoffice

# Install dependencies
pnpm install

# Copy env file and fill in values
cp .env.example .env.local
```

### Dev Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:coverage` | Vitest with coverage |
| `pnpm test:e2e` | Playwright e2e tests |
| `pnpm test:e2e:portal` | Portal-specific e2e |
| `pnpm test:e2e:ui` | Playwright UI mode |
| `pnpm eval` | Run all AI evals |
| `pnpm eval:retrieval` | Retrieval eval only |
| `pnpm eval:agent` | Agent eval only |
| `pnpm eval:health` | Context health eval |
| `pnpm eval:extraction` | Extraction eval |
| `pnpm db:reset` | Reset Supabase DB |
| `pnpm db:types` | Generate TypeScript types from DB |
| `pnpm tools:generate` | Generate tool documentation |
| `pnpm cap:sync` | Capacitor sync (mobile) |
| `pnpm cap:ios` | Open iOS project |
| `pnpm cap:android` | Open Android project |

### Node Path Workaround

Node is at `/opt/homebrew/bin/node` but not always on PATH in bash sessions:

```bash
PATH="/opt/homebrew/bin:$PATH" /opt/homebrew/bin/node <script>
```

---

## 9. Recommended Next Steps

### Tier 1 --- Polish (Immediate)

1. **Verify voice mode end-to-end** --- STT -> chat -> TTS response (needs browser testing)
2. ~~**Fix highlight-after-doc-switch race condition**~~ --- **DONE (v0.7.1)** --- pdfControls reset on switch, useEffect guard for deferred highlights
3. ~~**Upgrade portal model**~~ --- **DONE (v0.7.1)** --- now gemini-3.0-flash
4. **Fix AI Elements size props** --- `icon-sm` and `SelectTrigger size="sm"` compatibility

### Tier 2 --- Testing

5. **Portal unit tests** --- tools, intent detection, ChatVariant system
6. **Portal e2e tests** --- Playwright across 4 screen sizes
7. **ChatInterface component tests** --- key interaction flows
8. **Cron job tests** --- digest, synthesis, schedule execution
9. **MCP integration tests** --- full OAuth lifecycle

### Tier 3 --- Features

10. **Portal analytics** --- track what viewers looked at, time spent per section
11. **Multi-language portal** via Cartesia (40+ languages)
12. **Portal approval workflow** --- viewer approves/requests changes on sections
13. **DOCX-to-PDF conversion at upload time** (currently pre-built with LibreOffice)
14. **Canvas collaboration** --- real-time multi-user canvas editing

### Tier 4 --- Infrastructure

15. **AI Starter Kit integration** --- hooks for testing, docs, observability
16. **CLS optimization** --- reserve space for all async elements to get under 0.1
17. **Database backup strategy** --- Supabase backup automation
18. **Rate limiting improvements** --- per-user, per-org limits across all AI routes
19. **Observability** --- structured logging, AI SDK telemetry integration
20. **Mobile app** --- complete Capacitor integration for iOS/Android

---

## Appendix: File Tree Summary

```
layers-mf/
  src/
    app/              # 35+ pages, 50+ API route groups
    components/       # 88+ components across 5 directories
      ai-elements/    # 9 AI Elements components
      canvas/         # 7 canvas components
      chat/           # 4 chat sub-components
      ui/             # 43 shadcn/ui + custom components
    lib/              # Core business logic
      ai/             # AI config, tools, embeddings, evals
      db/             # Database search, queries
      agents/         # Agent templates
      discord/        # Discord adapter
      ditto/          # Ditto personality
      email/          # Email templates
      evals/          # AI evaluation suite
      inbox/          # Inbox generation
      ingest/         # Content ingestion pipeline
      inngest/        # Background job functions
      integrations/   # Third-party integrations
      json-render/    # JSON rendering
      kpi/            # KPI computation
      mcp/            # MCP utilities
      notifications/  # Notification system
      pipeline/       # Content processing pipeline
      sandbox/        # Sandbox utilities
      scaffolding/    # Project scaffolding
      skills/         # Skills system
      supabase/       # Supabase client setup
    data/             # Static data (changelog)
    types/            # TypeScript declarations
  docs/               # Local documentation
    ai-sdk/           # Vercel AI SDK v6 docs
    ai-gateway/       # AI Gateway docs
    ai-elements/      # AI Elements docs
  e2e/                # 24 Playwright spec files
  public/
    portal-docs/      # Portal document assets
  scripts/            # Build/conversion scripts
```
