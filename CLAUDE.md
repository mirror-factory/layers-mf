# CLAUDE.md

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning. Consult local docs and skill references before relying on training data.

> REMINDER: Push early, push often. Commit after each completed unit of work — every new function, test, or component. Small pushes catch issues early and keep the CI pipeline validating every iteration.

## Project Instructions

- **Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v3, shadcn/ui
- **Package manager**: pnpm
- **Dev**: `pnpm dev`
- **Build**: `pnpm build`
- **Lint**: `pnpm lint`
- **Patterns**: App Router with Server Components by default; "use client" only when needed
- **Components**: shadcn/ui components live in `src/components/ui/` — add new ones via `pnpm dlx shadcn@latest add <component>`
- **Styling**: Tailwind utilities + CSS variables defined in `src/app/globals.css`
- **Aliases**: `@/*` maps to `src/*`

## Skills

[Skills Index]
|IMPORTANT: When a skill is relevant, read its SKILL.md BEFORE writing code or creating files.

### Tier 0 — Always Active

|pm-linear|~/.claude/skills/pm-linear
|  desc: PM workflow for Linear — session protocol, context-rich comments, changelog, doc registry
|  use when: starting sessions, ending sessions, pushing code, updating Linear, onboarding devs

### Tier 1 — Core

|shadcn-ui|~/.claude/skills/shadcn-ui
|  desc: shadcn/ui component patterns, installation, forms with React Hook Form + Zod
|  use when: adding UI components, building forms, customizing themes

### Tier 2 — Architecture

|vercel-react-best-practices|~/.claude/skills/vercel-react-best-practices
|  desc: React/Next.js performance patterns from Vercel Engineering
|  use when: writing components, data fetching, bundle optimization

|nextjs-supabase-auth|~/.claude/skills/nextjs-supabase-auth
|  desc: Supabase Auth with Next.js App Router, middleware, protected routes
|  use when: adding authentication

### Tier 3 — AI Features

|claude-developer-platform|~/.claude/skills/claude-developer-platform
|  desc: Claude API + Anthropic SDK patterns
|  use when: adding AI features via Anthropic SDK

## Architecture

- `src/app/` — App Router pages and layouts
- `src/components/ui/` — shadcn/ui components (owned, customizable)
- `src/lib/utils.ts` — `cn()` and shared utilities
- `components.json` — shadcn/ui config
- `docs/` — local documentation (AI SDK, AI Elements, AI Gateway)

## Critical Paths

- `src/app/layout.tsx` — root layout, add providers here
- `src/app/globals.css` — CSS variables and Tailwind base styles
- `src/lib/utils.ts` — shared utilities

## Component Registry

Key components for LLM lookup (88 total across 4 dirs):

| Name | Location | Description | Tags |
|------|----------|-------------|------|
| ChatInterface | src/components/chat-interface.tsx | Full agentic chat with tools, context, artifacts | chat, ai |
| TiptapEditor | src/components/tiptap-editor.tsx | Rich text editor with AI assist | editor, ai |
| MCPServerCard | src/components/mcp-server-card.tsx | MCP connection card with PKCE OAuth | mcp, oauth |
| ContextLibrary | src/components/context-library.tsx | Browse/manage context items | context, library |
| SidebarNav | src/components/sidebar-nav.tsx | Main sidebar navigation | navigation, layout |
| InterviewUI | src/components/interview-ui.tsx | ask_user tool interview form | interview, form |
| SkillsEditor | src/components/skills-editor.tsx | Manage skills with editor | skills, editor |
| ContextWindowBar | src/components/chat/context-window-bar.tsx | Token counter + context visualization | chat, tokens |
| Message | src/components/ai-elements/message.tsx | UIMessage renderer with Markdown | ai-elements |
| Tool | src/components/ai-elements/tool.tsx | Tool call display with status | ai-elements |

**shadcn/ui** (24 in `src/components/ui/`): Button, Card, Input, Badge, Select, Dialog, Tabs, DropdownMenu, Command, Tooltip, etc.

## API Registry

118 routes total. Key routes:

| Path | Method | Description | Auth |
|------|--------|-------------|------|
| /api/chat | POST | Agentic chat with ToolLoopAgent | Supabase |
| /api/chat/history | GET | Fetch chat messages | Supabase |
| /api/chat/context-stats | GET | Token counts for system/rules/tools | Supabase |
| /api/context/search | POST | Hybrid search (vector + BM25) | Supabase |
| /api/context/[id] | GET/PATCH/DELETE | CRUD context item | Supabase |
| /api/analytics/costs | GET | AI costs by model/user/date | Supabase |
| /api/mcp-servers | GET/POST | List/add MCP servers | Supabase |
| /api/mcp/discover | POST | Discover MCP from registry | Supabase |
| /api/skills | GET/POST | List/create skills | Supabase |
| /api/schedules | GET/POST | List/create schedules | Supabase |
| /api/approval | GET/POST | List/create approvals | Supabase |
| /api/priority-docs | GET/POST/PATCH/DELETE | Priority doc management | Supabase |
| /api/rules | GET/POST/PATCH/DELETE | Rules management | Supabase |
| /api/sandbox/restart | POST | Restart sandbox | Supabase |

**Cron**: /api/cron/{digest,ingest,synthesis,execute-schedules,linear-check,credit-reset}
**Webhooks**: /api/webhooks/{stripe,linear,nango,google-drive,discord}

## Vercel AI SDK Docs

[AI SDK Docs Index]
|root: ./docs/ai-sdk
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any AI SDK tasks.
|00-introduction:{index.mdx}
|02-foundations:{index.mdx,01-overview.mdx,02-providers-and-models.mdx,03-prompts.mdx,04-tools.mdx,05-streaming.mdx}
|02-getting-started:{index.mdx,00-choosing-a-provider.mdx,01-navigating-the-library.mdx,02-nextjs-app-router.mdx,03-nextjs-pages-router.mdx,04-svelte.mdx,05-nuxt.mdx,06-nodejs.mdx,07-expo.mdx,08-tanstack-start.mdx}
|03-agents:{index.mdx,01-overview.mdx,02-building-agents.mdx,03-workflows.mdx,04-loop-control.mdx,05-configuring-call-options.mdx}
|03-ai-sdk-core:{index.mdx,01-overview.mdx,05-generating-text.mdx,10-generating-structured-data.mdx,15-tools-and-tool-calling.mdx,16-mcp-tools.mdx,20-prompt-engineering.mdx,25-settings.mdx,30-embeddings.mdx,31-reranking.mdx,35-image-generation.mdx,36-transcription.mdx,37-speech.mdx,40-middleware.mdx,45-provider-management.mdx,50-error-handling.mdx,55-testing.mdx,60-telemetry.mdx,65-devtools.mdx}
|04-ai-sdk-ui:{index.mdx,01-overview.mdx,02-chatbot.mdx,03-chatbot-message-persistence.mdx,03-chatbot-resume-streams.mdx,03-chatbot-tool-usage.mdx,04-generative-user-interfaces.mdx,05-completion.mdx,08-object-generation.mdx,20-streaming-data.mdx,21-error-handling.mdx,21-transport.mdx,24-reading-ui-message-streams.mdx,25-message-metadata.mdx,50-stream-protocol.mdx}
|05-ai-sdk-rsc:{index.mdx,01-overview.mdx,02-streaming-react-components.mdx,03-generative-ui-state.mdx,03-saving-and-restoring-states.mdx,04-multistep-interfaces.mdx,05-streaming-values.mdx,06-loading-state.mdx,08-error-handling.mdx,09-authentication.mdx,10-migrating-to-ui.mdx}
|06-advanced:{index.mdx,01-prompt-engineering.mdx,02-stopping-streams.mdx,03-backpressure.mdx,04-caching.mdx,05-multiple-streamables.mdx,06-rate-limiting.mdx,07-rendering-ui-with-language-models.mdx,08-model-as-router.mdx,09-multistep-interfaces.mdx,09-sequential-generations.mdx,10-vercel-deployment-guide.mdx}
|07-reference/01-ai-sdk-core:{index.mdx,01-generate-text.mdx,02-stream-text.mdx,03-generate-object.mdx,04-stream-object.mdx,05-embed.mdx,06-embed-many.mdx,06-rerank.mdx,10-generate-image.mdx,11-transcribe.mdx,12-generate-speech.mdx,15-agent.mdx,16-tool-loop-agent.mdx,17-create-agent-ui-stream.mdx,18-create-agent-ui-stream-response.mdx,18-pipe-agent-ui-stream-to-response.mdx,20-tool.mdx,22-dynamic-tool.mdx,23-create-mcp-client.mdx,24-mcp-stdio-transport.mdx,25-json-schema.mdx,26-zod-schema.mdx,27-valibot-schema.mdx,28-output.mdx,30-model-message.mdx,31-ui-message.mdx,32-validate-ui-messages.mdx,33-safe-validate-ui-messages.mdx,40-provider-registry.mdx,42-custom-provider.mdx,50-cosine-similarity.mdx,60-wrap-language-model.mdx,61-wrap-image-model.mdx,65-language-model-v2-middleware.mdx,66-extract-reasoning-middleware.mdx,67-simulate-streaming-middleware.mdx,68-default-settings-middleware.mdx,69-add-tool-input-examples-middleware.mdx,70-extract-json-middleware.mdx,70-step-count-is.mdx,71-has-tool-call.mdx,75-simulate-readable-stream.mdx,80-smooth-stream.mdx,90-generate-id.mdx,91-create-id-generator.mdx}
|07-reference/02-ai-sdk-ui:{index.mdx,01-use-chat.mdx,02-use-completion.mdx,03-use-object.mdx,31-convert-to-model-messages.mdx,32-prune-messages.mdx,40-create-ui-message-stream.mdx,41-create-ui-message-stream-response.mdx,42-pipe-ui-message-stream-to-response.mdx,43-read-ui-message-stream.mdx,46-infer-ui-tools.mdx,47-infer-ui-tool.mdx,50-direct-chat-transport.mdx}
|07-reference/03-ai-sdk-rsc:{index.mdx,01-stream-ui.mdx,02-create-ai.mdx,03-create-streamable-ui.mdx,04-create-streamable-value.mdx,05-read-streamable-value.mdx,06-get-ai-state.mdx,07-get-mutable-ai-state.mdx,08-use-ai-state.mdx,09-use-actions.mdx,10-use-ui-state.mdx,11-use-streamable-value.mdx,20-render.mdx}
|07-reference/05-ai-sdk-errors:{index.mdx,ai-api-call-error.mdx,ai-download-error.mdx,ai-empty-response-body-error.mdx,ai-invalid-argument-error.mdx,ai-invalid-data-content-error.mdx,ai-invalid-message-role-error.mdx,ai-invalid-prompt-error.mdx,ai-invalid-response-data-error.mdx,ai-invalid-tool-approval-error.mdx,ai-invalid-tool-input-error.mdx,ai-json-parse-error.mdx,ai-load-api-key-error.mdx,ai-load-setting-error.mdx,ai-message-conversion-error.mdx,ai-no-content-generated-error.mdx,ai-no-image-generated-error.mdx,ai-no-object-generated-error.mdx,ai-no-output-generated-error.mdx,ai-no-speech-generated-error.mdx,ai-no-such-model-error.mdx,ai-no-such-provider-error.mdx,ai-no-such-tool-error.mdx,ai-no-transcript-generated-error.mdx,ai-retry-error.mdx,ai-too-many-embedding-values-for-call-error.mdx,ai-tool-call-not-found-for-approval-error.mdx,ai-tool-call-repair-error.mdx,ai-type-validation-error.mdx,ai-ui-message-stream-error.mdx,ai-unsupported-functionality-error.mdx}
|07-reference:{index.mdx}
|08-migration-guides:{index.mdx,00-versioning.mdx,24-migration-guide-6-0.mdx,25-migration-guide-5-0-data.mdx,26-migration-guide-5-0.mdx,27-migration-guide-4-2.mdx,28-migration-guide-4-1.mdx,29-migration-guide-4-0.mdx,36-migration-guide-3-4.mdx,37-migration-guide-3-3.mdx,38-migration-guide-3-2.mdx,39-migration-guide-3-1.mdx}
|09-troubleshooting:{index.mdx,01-azure-stream-slow.mdx,03-server-actions-in-client-components.mdx,04-strange-stream-output.mdx,05-streamable-ui-errors.mdx,05-tool-invocation-missing-result.mdx,06-streaming-not-working-when-deployed.mdx,06-streaming-not-working-when-proxied.mdx,06-timeout-on-vercel.mdx,07-unclosed-streams.mdx,08-use-chat-failed-to-parse-stream.mdx,09-client-stream-error.mdx,10-use-chat-tools-no-response.mdx,11-use-chat-custom-request-options.mdx,12-typescript-performance-zod.mdx,12-use-chat-an-error-occurred.mdx,13-repeated-assistant-messages.mdx,14-stream-abort-handling.mdx,14-tool-calling-with-structured-outputs.mdx,15-abort-breaks-resumable-streams.mdx,15-stream-text-not-working.mdx,16-streaming-status-delay.mdx,17-use-chat-stale-body-data.mdx,18-ontoolcall-type-narrowing.mdx,19-unsupported-model-version.mdx,20-no-object-generated-content-filter.mdx,21-missing-tool-results-error.mdx,30-model-is-not-assignable-to-type.mdx,40-typescript-cannot-find-namespace-jsx.mdx,50-react-maximum-update-depth-exceeded.mdx,60-jest-cannot-find-module-ai-rsc.mdx,70-high-memory-usage-with-images.mdx}

## AI Gateway Docs

[AI Gateway Docs Index]
|root: ./docs/ai-gateway
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any AI Gateway tasks.
|{01-getting-started.md,02-models-and-providers.md,03-provider-options.md,04-model-fallbacks.md}

## AI Elements Docs

[AI Elements Docs Index]
|root: ./docs/ai-elements
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any AI Elements tasks.
|{index.mdx,usage.mdx,troubleshooting.mdx}
|components/chatbot:{attachments.mdx,chain-of-thought.mdx,checkpoint.mdx,confirmation.mdx,context.mdx,conversation.mdx,inline-citation.mdx,message.mdx,model-selector.mdx,plan.mdx,prompt-input.mdx,queue.mdx,reasoning.mdx,shimmer.mdx,sources.mdx,suggestion.mdx,task.mdx,tool.mdx}
|components/code:{agent.mdx,artifact.mdx,code-block.mdx,commit.mdx,environment-variables.mdx,file-tree.mdx,package-info.mdx,sandbox.mdx,schema-display.mdx,snippet.mdx,stack-trace.mdx,terminal.mdx,test-results.mdx,web-preview.mdx}
|components/utilities:{image.mdx,loader.mdx,open-in-chat.mdx}
|components/voice:{audio-player.mdx,mic-selector.mdx,persona.mdx,speech-input.mdx,transcription.mdx,voice-selector.mdx}
|components/workflow:{canvas.mdx,connection.mdx,controls.mdx,edge.mdx,node.mdx,panel.mdx,toolbar.mdx}
|examples:{index.mdx,chatbot.mdx,v0.mdx,workflow.mdx}

> REMINDER: Before ending a session — commit and push all completed work. Every push triggers CI (tests + coverage + typecheck). Unpushed work is unvalidated work.
