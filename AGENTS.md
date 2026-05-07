# AGENTS.md

<!-- PROJECT-INDEX:START -->

## PROJECT INDEX (compressed)

layers-mf | next-16 + ai-sdk-v6 + supabase + playwright | spec: .ai-dev-kit/spec.md

REGISTRIES (1)
  components (176)

ENFORCEMENT
  gates: 34 | fail-closed | bypass flags: DESIGN/BRAND/TDD/CONTEXT7/EXPECT/MANIFEST/DEPS_SKIP
  ai_calls_30d: 0 | cost_30d: $0 | tests_30d: 0 | skills_30d: 0

NAV: /dev-kit/index for visual · .ai-dev-kit/registries/index.yaml for machine

<!-- PROJECT-INDEX:END -->

Compressed documentation index for AI coding agents.

> **Retrieval-led reasoning**: Consult local docs before relying on pre-training.

## Quick Reference

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v3, shadcn/ui
**Package Manager**: pnpm
**Dev Command**: `pnpm dev`
**Build Command**: `pnpm build`
**Lint Command**: `pnpm lint`
**Add UI component**: `pnpm dlx shadcn@latest add <component>`

## Skills Registry

```
shadcn-ui         ~/.claude/skills/shadcn-ui        shadcn/ui components, forms, themes
vercel-react      ~/.claude/skills/vercel-react-best-practices  React/Next.js perf patterns
nextjs-supabase   ~/.claude/skills/nextjs-supabase-auth         Auth with App Router
claude-api        ~/.claude/skills/claude-developer-platform    Anthropic SDK + Claude API
```

## Critical Paths

- `src/app/layout.tsx` — root layout, providers go here
- `src/app/globals.css` — CSS variables, Tailwind base
- `src/components/ui/` — shadcn/ui components (owned code)
- `src/lib/utils.ts` — `cn()` helper
- `components.json` — shadcn/ui config

## Documentation Indexes

### AI SDK Docs

**Root**: `./docs/ai-sdk`

```
00-introduction:{index.mdx}
02-foundations:{index.mdx,01-overview.mdx,02-providers-and-models.mdx,03-prompts.mdx,04-tools.mdx,05-streaming.mdx}
02-getting-started:{index.mdx,00-choosing-a-provider.mdx,01-navigating-the-library.mdx,02-nextjs-app-router.mdx,03-nextjs-pages-router.mdx,04-svelte.mdx,05-nuxt.mdx,06-nodejs.mdx,07-expo.mdx,08-tanstack-start.mdx}
03-agents:{index.mdx,01-overview.mdx,02-building-agents.mdx,03-workflows.mdx,04-loop-control.mdx,05-configuring-call-options.mdx}
03-ai-sdk-core:{index.mdx,01-overview.mdx,05-generating-text.mdx,10-generating-structured-data.mdx,15-tools-and-tool-calling.mdx,16-mcp-tools.mdx,20-prompt-engineering.mdx,25-settings.mdx,30-embeddings.mdx,31-reranking.mdx,35-image-generation.mdx,36-transcription.mdx,37-speech.mdx,40-middleware.mdx,45-provider-management.mdx,50-error-handling.mdx,55-testing.mdx,60-telemetry.mdx,65-devtools.mdx}
04-ai-sdk-ui:{index.mdx,01-overview.mdx,02-chatbot.mdx,03-chatbot-message-persistence.mdx,03-chatbot-resume-streams.mdx,03-chatbot-tool-usage.mdx,04-generative-user-interfaces.mdx,05-completion.mdx,08-object-generation.mdx,20-streaming-data.mdx,21-error-handling.mdx,21-transport.mdx,24-reading-ui-message-streams.mdx,25-message-metadata.mdx,50-stream-protocol.mdx}
05-ai-sdk-rsc:{index.mdx,01-overview.mdx,02-streaming-react-components.mdx,03-generative-ui-state.mdx,03-saving-and-restoring-states.mdx,04-multistep-interfaces.mdx,05-streaming-values.mdx,06-loading-state.mdx,08-error-handling.mdx,09-authentication.mdx,10-migrating-to-ui.mdx}
06-advanced:{index.mdx,01-prompt-engineering.mdx,02-stopping-streams.mdx,03-backpressure.mdx,04-caching.mdx,05-multiple-streamables.mdx,06-rate-limiting.mdx,07-rendering-ui-with-language-models.mdx,08-model-as-router.mdx,09-multistep-interfaces.mdx,09-sequential-generations.mdx,10-vercel-deployment-guide.mdx}
07-reference/01-ai-sdk-core:{index.mdx,01-generate-text.mdx,02-stream-text.mdx,03-generate-object.mdx,04-stream-object.mdx,05-embed.mdx,06-embed-many.mdx,06-rerank.mdx,10-generate-image.mdx,11-transcribe.mdx,12-generate-speech.mdx,15-agent.mdx,16-tool-loop-agent.mdx,17-create-agent-ui-stream.mdx,18-create-agent-ui-stream-response.mdx,18-pipe-agent-ui-stream-to-response.mdx,20-tool.mdx,22-dynamic-tool.mdx,23-create-mcp-client.mdx,24-mcp-stdio-transport.mdx,25-json-schema.mdx,26-zod-schema.mdx,27-valibot-schema.mdx,28-output.mdx,30-model-message.mdx,31-ui-message.mdx,32-validate-ui-messages.mdx,33-safe-validate-ui-messages.mdx,40-provider-registry.mdx,42-custom-provider.mdx,50-cosine-similarity.mdx,60-wrap-language-model.mdx,61-wrap-image-model.mdx,65-language-model-v2-middleware.mdx,66-extract-reasoning-middleware.mdx,67-simulate-streaming-middleware.mdx,68-default-settings-middleware.mdx,69-add-tool-input-examples-middleware.mdx,70-extract-json-middleware.mdx,70-step-count-is.mdx,71-has-tool-call.mdx,75-simulate-readable-stream.mdx,80-smooth-stream.mdx,90-generate-id.mdx,91-create-id-generator.mdx}
07-reference/02-ai-sdk-ui:{index.mdx,01-use-chat.mdx,02-use-completion.mdx,03-use-object.mdx,31-convert-to-model-messages.mdx,32-prune-messages.mdx,40-create-ui-message-stream.mdx,41-create-ui-message-stream-response.mdx,42-pipe-ui-message-stream-to-response.mdx,43-read-ui-message-stream.mdx,46-infer-ui-tools.mdx,47-infer-ui-tool.mdx,50-direct-chat-transport.mdx}
07-reference/03-ai-sdk-rsc:{index.mdx,01-stream-ui.mdx,02-create-ai.mdx,03-create-streamable-ui.mdx,04-create-streamable-value.mdx,05-read-streamable-value.mdx,06-get-ai-state.mdx,07-get-mutable-ai-state.mdx,08-use-ai-state.mdx,09-use-actions.mdx,10-use-ui-state.mdx,11-use-streamable-value.mdx,20-render.mdx}
07-reference/05-ai-sdk-errors:{index.mdx,ai-api-call-error.mdx,ai-download-error.mdx,ai-empty-response-body-error.mdx,ai-invalid-argument-error.mdx,ai-invalid-data-content-error.mdx,ai-invalid-message-role-error.mdx,ai-invalid-prompt-error.mdx,ai-invalid-response-data-error.mdx,ai-invalid-tool-approval-error.mdx,ai-invalid-tool-input-error.mdx,ai-json-parse-error.mdx,ai-load-api-key-error.mdx,ai-load-setting-error.mdx,ai-message-conversion-error.mdx,ai-no-content-generated-error.mdx,ai-no-image-generated-error.mdx,ai-no-object-generated-error.mdx,ai-no-output-generated-error.mdx,ai-no-speech-generated-error.mdx,ai-no-such-model-error.mdx,ai-no-such-provider-error.mdx,ai-no-such-tool-error.mdx,ai-no-transcript-generated-error.mdx,ai-retry-error.mdx,ai-too-many-embedding-values-for-call-error.mdx,ai-tool-call-not-found-for-approval-error.mdx,ai-tool-call-repair-error.mdx,ai-type-validation-error.mdx,ai-ui-message-stream-error.mdx,ai-unsupported-functionality-error.mdx}
07-reference:{index.mdx}
08-migration-guides:{index.mdx,00-versioning.mdx,24-migration-guide-6-0.mdx,25-migration-guide-5-0-data.mdx,26-migration-guide-5-0.mdx,27-migration-guide-4-2.mdx,28-migration-guide-4-1.mdx,29-migration-guide-4-0.mdx,36-migration-guide-3-4.mdx,37-migration-guide-3-3.mdx,38-migration-guide-3-1.mdx}
09-troubleshooting:{index.mdx,01-azure-stream-slow.mdx,03-server-actions-in-client-components.mdx,04-strange-stream-output.mdx,05-streamable-ui-errors.mdx,05-tool-invocation-missing-result.mdx,06-streaming-not-working-when-deployed.mdx,06-streaming-not-working-when-proxied.mdx,06-timeout-on-vercel.mdx,07-unclosed-streams.mdx,08-use-chat-failed-to-parse-stream.mdx,09-client-stream-error.mdx,10-use-chat-tools-no-response.mdx,11-use-chat-custom-request-options.mdx,12-typescript-performance-zod.mdx,12-use-chat-an-error-occurred.mdx,13-repeated-assistant-messages.mdx,14-stream-abort-handling.mdx,14-tool-calling-with-structured-outputs.mdx,15-abort-breaks-resumable-streams.mdx,15-stream-text-not-working.mdx,16-streaming-status-delay.mdx,17-use-chat-stale-body-data.mdx,18-ontoolcall-type-narrowing.mdx,19-unsupported-model-version.mdx,20-no-object-generated-content-filter.mdx,21-missing-tool-results-error.mdx,30-model-is-not-assignable-to-type.mdx,40-typescript-cannot-find-namespace-jsx.mdx,50-react-maximum-update-depth-exceeded.mdx,60-jest-cannot-find-module-ai-rsc.mdx,70-high-memory-usage-with-images.mdx}
```

### AI Gateway Docs

**Root**: `./docs/ai-gateway`

```
{01-getting-started.md,02-models-and-providers.md,03-provider-options.md,04-model-fallbacks.md}
```

### AI Elements Docs

**Root**: `./docs/ai-elements`

```
{index.mdx,usage.mdx,troubleshooting.mdx}
components/chatbot:{attachments.mdx,chain-of-thought.mdx,checkpoint.mdx,confirmation.mdx,context.mdx,conversation.mdx,inline-citation.mdx,message.mdx,model-selector.mdx,plan.mdx,prompt-input.mdx,queue.mdx,reasoning.mdx,shimmer.mdx,sources.mdx,suggestion.mdx,task.mdx,tool.mdx}
components/code:{agent.mdx,artifact.mdx,code-block.mdx,commit.mdx,environment-variables.mdx,file-tree.mdx,package-info.mdx,sandbox.mdx,schema-display.mdx,snippet.mdx,stack-trace.mdx,terminal.mdx,test-results.mdx,web-preview.mdx}
components/utilities:{image.mdx,loader.mdx,open-in-chat.mdx}
components/voice:{audio-player.mdx,mic-selector.mdx,persona.mdx,speech-input.mdx,transcription.mdx,voice-selector.mdx}
components/workflow:{canvas.mdx,connection.mdx,controls.mdx,edge.mdx,node.mdx,panel.mdx,toolbar.mdx}
examples:{index.mdx,chatbot.mdx,v0.mdx,workflow.mdx}
```

---

_Keep docs in `./docs/` structure for consistency._

<!-- KIT-CATALOG:START -->

## Kit Catalog

**Every file the kit ships, grouped by purpose.** Before writing a new file, check if it's already here. If it is, copy the template instead of writing from scratch. Reinventing kit-shipped code is a documented failure mode.

_Auto-generated by `ai-dev-kit onboard`. Last refreshed 2026-05-06._

### Agent context

| Project path | Purpose |
|--------------|---------|
| `CLAUDE.md` | Claude Code entry point (points to AGENTS.md) |
| `docs/guides/AI-STARTER-HUB.md` | starter-hub overview doc |
| `llms.txt` | machine-readable project summary for LLMs |

### API routes

| Project path | Purpose |
|--------------|---------|
| `app/api/dev-kit/config/[name]/route.ts` | POST /api/dev-kit/config/[name] -- writes YAML to disk for the allowlisted slug (404 on any other slug so arbitrary paths are never writable); basic YAML sanity check before writeFileSync; relies on DEV_KIT_DASHBOARD_SECRET middleware for auth |
| `app/api/dev-kit/config/route.ts` | GET the editable-config allowlist + current YAML content of every file (design-tokens, design-system, budget, notify, observability, requirements) for the /dev-kit/config editor; auth via DEV_KIT_DASHBOARD_SECRET middleware |
| `app/api/dev-kit/connectors/route.ts` | /api/dev-kit/connectors |
| `app/api/dev-kit/cost/route.ts` | /api/dev-kit/cost |
| `app/api/dev-kit/coverage/route.ts` | /api/dev-kit/coverage |
| `app/api/dev-kit/dependencies/route.ts` | /api/dev-kit/dependencies |
| `app/api/dev-kit/deployments/route.ts` | /api/dev-kit/deployments |
| `app/api/dev-kit/design-system/route.ts` | GET tokens + system spec + components.yaml for the /dev-kit/design-system dashboard |
| `app/api/dev-kit/evals/[id]/route.ts` | /api/dev-kit/evals/[id] |
| `app/api/dev-kit/evals/route.ts` | /api/dev-kit/evals |
| `app/api/dev-kit/features/[name]/route.ts` | /api/dev-kit/features/[name] |
| `app/api/dev-kit/features/route.ts` | /api/dev-kit/features |
| `app/api/dev-kit/index/route.ts` | /api/dev-kit/index |
| `app/api/dev-kit/logs/unified/route.ts` | /api/dev-kit/logs/unified |
| `app/api/dev-kit/overview/route.ts` | /api/dev-kit/overview |
| `app/api/dev-kit/registries/route.ts` | /api/dev-kit/registries |
| `app/api/dev-kit/regressions/route.ts` | /api/dev-kit/regressions |
| `app/api/dev-kit/runs/[run_id]/route.ts` | /api/dev-kit/runs/[run_id] |
| `app/api/dev-kit/runs/route.ts` | /api/dev-kit/runs |
| `app/api/dev-kit/sessions/[id]/route.ts` | /api/dev-kit/sessions/[id] |
| `app/api/dev-kit/sessions/route.ts` | /api/dev-kit/sessions |
| `app/api/dev-kit/status/route.ts` | /api/dev-kit/status |
| `app/api/dev-kit/tools/route.ts` | /api/dev-kit/tools |
| `app/api/health/route.ts` | /api/health |
| `app/api/observability/health/route.ts` | /api/observability/health |

### Brand + style guides

| Project path | Purpose |
|--------------|---------|
| `docs/brand-guide.md` | brand identity + color + typography + voice (fill in per project) |
| `docs/style-guide.md` | component-level rules + accessibility + testing requirements |

### CI

| Project path | Purpose |
|--------------|---------|
| `.github/workflows/ai-dev-kit.yml` | GitHub Actions: ai-dev-kit.yml |
| `.github/workflows/cost-drift.yml` | GitHub Actions: cost-drift.yml |
| `.github/workflows/dependency-audit.yml` | GitHub Actions: dependency-audit.yml |
| `.github/workflows/nightly.yml` | GitHub Actions: nightly.yml |

### Claude Code hooks

| Project path | Purpose |
|--------------|---------|
| `.claude/hooks/context7-suggest` | context7-suggest lifecycle hook |
| `.claude/hooks/observability-context` | observability-context lifecycle hook |
| `.claude/hooks/periodic-reground` | periodic-reground lifecycle hook |
| `.claude/hooks/postuse-format` | postuse-format lifecycle hook |
| `.claude/hooks/record-docs-lookup.py` | PostToolUse(WebFetch/MCP): tags every docs fetch with run_id so /dev-kit/runs/[run_id] shows "docs consulted" |
| `.claude/hooks/record-kit-event.py` | kit-audit python helper: appends a KitAuditEvent to .ai-dev-kit/state/kit-audit.jsonl (importable as log_kit_event() by other hooks, or callable as CLI) -- 0.2.17 audit backbone |
| `.claude/hooks/record-skill-use.py` | PreToolUse(Skill): appends to .ai-dev-kit/state/skill-invocations.jsonl so skills.yaml and /dev-kit/registries Skills tab show real usage |
| `.claude/hooks/session-start-run.py` | SessionStart: generates run_id, writes .ai-dev-kit/state/current-run.json -- the backbone every log/test/cost tag ties back to |
| `.claude/hooks/session-startup` | session-startup lifecycle hook |
| `.claude/hooks/track-edits` | track-edits lifecycle hook |
| `.claude/hooks/verify-before-stop` | verify-before-stop lifecycle hook |
| `.claude/hooks/verify-claims` | verify-claims lifecycle hook |
| `.claude/settings.json` | hook wiring (merged, not replaced) -- includes SessionStart/PreToolUse/PostToolUse/Stop |

### Core runtime

| Project path | Purpose |
|--------------|---------|
| `lib/_metadata` | runtime module: _metadata |
| `lib/_registry` | runtime module: _registry |
| `lib/_types` | runtime module: _types |
| `lib/ai-dev-kit.lock` | runtime module: ai-dev-kit.lock |
| `lib/dashboard-data` | runtime module: dashboard-data |
| `lib/devtools-setup` | runtime module: devtools-setup |
| `lib/local-models` | runtime module: local-models |
| `lib/notification-events` | runtime module: notification-events |
| `lib/project.config` | runtime module: project.config |
| `lib/promptfooconfig` | runtime module: promptfooconfig |
| `lib/recordings-allowlist` | runtime module: recordings-allowlist |
| `lib/research-cache` | runtime module: research-cache |
| `lib/tool-rubrics` | runtime module: tool-rubrics |
| `lib/workflow-example` | runtime module: workflow-example |

### Dashboard pages

| Project path | Purpose |
|--------------|---------|
| `app/dev-kit/config/config-editor.tsx` | /dev-kit/config client editor -- owns fetch + per-slug draft + save/revert state; POSTs to /api/dev-kit/config/[slug] which enforces the same allowlist behind DEV_KIT_DASHBOARD_SECRET middleware auth |
| `app/dev-kit/config/page.tsx` | /dev-kit/config -- tabbed YAML editor for the six allowlisted project configs (design tokens / design system / budget / notify / observability / requirements); server shell reads theme and forwards to the client editor |
| `app/dev-kit/connectors/page.tsx` | /dev-kit/connectors page |
| `app/dev-kit/cost/page.tsx` | /dev-kit/cost page |
| `app/dev-kit/coverage/page.tsx` | /dev-kit/coverage page |
| `app/dev-kit/dependencies/page.tsx` | /dev-kit/dependencies page |
| `app/dev-kit/deployments/page.tsx` | /dev-kit/deployments page |
| `app/dev-kit/design-system/inline-editor.tsx` | /dev-kit/design-system inline editor (client) -- textarea + save/revert for design-tokens.yaml and design-system.yaml; POSTs through the DEV_KIT_DASHBOARD_SECRET-guarded /api/dev-kit/config allowlist |
| `app/dev-kit/design-system/page.tsx` | /dev-kit/design-system -- tokens (with color swatches) + system spec + components registry -- the whole design system in one view; now embeds inline editors that POST to /api/dev-kit/config |
| `app/dev-kit/evals/[id]/page.tsx` | /dev-kit/evals/[id] page |
| `app/dev-kit/evals/page.tsx` | /dev-kit/evals page |
| `app/dev-kit/features/[name]/page.tsx` | /dev-kit/features/[name] page |
| `app/dev-kit/features/page.tsx` | /dev-kit/features page |
| `app/dev-kit/index/page.tsx` | /dev-kit/index page |
| `app/dev-kit/layout.tsx` | /dev-kit/layout.tsx page |
| `app/dev-kit/page.tsx` | /dev-kit/ page |
| `app/dev-kit/registries/components-preview.tsx` | /dev-kit/registries Components tab -- live Storybook iframe per component (uses stories_path from components.yaml); placeholder when story is missing |
| `app/dev-kit/registries/page.tsx` | /dev-kit/registries -- tabs: Vendors | Components | Pages | Tools | Skills | Design tokens (all live from .ai-dev-kit/registries/*) |
| `app/dev-kit/registries/views/apis-view.tsx` | /dev-kit/registries/views/apis-view.tsx page |
| `app/dev-kit/registries/views/components-view.tsx` | /dev-kit/registries/views/components-view.tsx page |
| `app/dev-kit/registries/views/design-view.tsx` | /dev-kit/registries/views/design-view.tsx page |
| `app/dev-kit/registries/views/docs-view.tsx` | /dev-kit/registries/views/docs-view.tsx page |
| `app/dev-kit/registries/views/hooks-view.tsx` | /dev-kit/registries/views/hooks-view.tsx page |
| `app/dev-kit/registries/views/mcps-view.tsx` | /dev-kit/registries/views/mcps-view.tsx page |
| `app/dev-kit/registries/views/pages-view.tsx` | /dev-kit/registries/views/pages-view.tsx page |
| `app/dev-kit/registries/views/rollups-view.tsx` | /dev-kit/registries/views/rollups-view.tsx page |
| `app/dev-kit/registries/views/skills-view.tsx` | /dev-kit/registries/views/skills-view.tsx page |
| `app/dev-kit/registries/views/table.tsx` | /dev-kit/registries/views/table.tsx page |
| `app/dev-kit/registries/views/tests-view.tsx` | /dev-kit/registries/views/tests-view.tsx page |
| `app/dev-kit/registries/views/tools-view.tsx` | /dev-kit/registries/views/tools-view.tsx page |
| `app/dev-kit/registries/views/types.ts` | /dev-kit/registries/views/types.ts page |
| `app/dev-kit/registries/views/vendors-view.tsx` | /dev-kit/registries/views/vendors-view.tsx page |
| `app/dev-kit/regressions/page.tsx` | /dev-kit/regressions page |
| `app/dev-kit/runs/[run_id]/page.tsx` | /dev-kit/runs/[run_id] -- single run: AI calls, vendor calls, tests, docs consulted, costs (LLM + vendor), skills invoked -- the ONE place to see a feature build end-to-end |
| `app/dev-kit/runs/[run_id]/run-view.tsx` | /dev-kit/runs/[run_id] client view -- tabs + fetch; every color/font/space reads from the serialized theme |
| `app/dev-kit/runs/page.tsx` | /dev-kit/runs -- feature-build index (ULID-sortable list w/ status, cost, duration) |
| `app/dev-kit/runs/runs-list.tsx` | /dev-kit/runs client table -- receives serialized theme from the server page; owns fetch + loading state |
| `app/dev-kit/sessions/[id]/page.tsx` | /dev-kit/sessions/[id] page |
| `app/dev-kit/sessions/page.tsx` | /dev-kit/sessions page |
| `app/dev-kit/status/page.tsx` | /dev-kit/status -- sinks, coverage, registries, run results |
| `app/dev-kit/tools/page.tsx` | /dev-kit/tools page |
| `app/dev-kit/use-realtime.tsx` | /dev-kit/use-realtime.tsx page |
| `app/drift-page` | legacy page template: drift-page |
| `app/performance-page` | legacy page template: performance-page |
| `app/rubrics-page` | legacy page template: rubrics-page |
| `app/tests-dashboard-page` | legacy page template: tests-dashboard-page |
| `app/video-registry-page` | legacy page template: video-registry-page |

### Dynamic registries

| Project path | Purpose |
|--------------|---------|
| `.ai-dev-kit/registries/api-routes.yaml` | API routes registry (auto-synced from app/**/route.ts; one entry per exported HTTP method) -- closes the 0.2.13 gap where /api/* endpoints had no registry surface |
| `.ai-dev-kit/registries/components.yaml` | UI components registry (auto-synced from components/**/*.tsx; used by /dev-kit/registries Components tab + verify-before-stop UI coverage) |
| `.ai-dev-kit/registries/design-system.yaml` | design system spec (primitives / molecules / organisms / templates / patterns with variants + states + a11y + tokens); populated by @design-agent, judged by check-brand-compliance.mts |
| `.ai-dev-kit/registries/design-tokens.yaml` | brand primitives (colors / typography scale / spacing / radius / shadow / motion / elevation / breakpoints); check-brand-tokens.ts fails commits that use unapproved literals |
| `.ai-dev-kit/registries/docs.yaml` | Docs registry (0.2.19) -- every docs/**/*.md; word_count, inbound_links, outbound_links_broken; doctor fails on any broken outbound link |
| `.ai-dev-kit/registries/hooks.yaml` | Hooks registry (0.2.19) -- every .husky/* + .claude/hooks/*.py; tracks wired_in_settings + kit_audit_instrumented so doctor can fail on unwired claude hooks |
| `.ai-dev-kit/registries/mcp-servers.yaml` | MCP servers registry (auto-synced from .mcp.json; used by doctor checkMcpHealth to warn on missing required env vars and drift between .mcp.json and this YAML) |
| `.ai-dev-kit/registries/pages.yaml` | Pages/routes registry (auto-synced from app/**/page.tsx; viewports_tested + e2e_video_path + react_scan_clean) |
| `.ai-dev-kit/registries/skills.yaml` | Skills usage registry (invocation_count populated by record-skill-use.py hook -- measures Vercel "79% auto-invoke" concern) |
| `.ai-dev-kit/registries/tests.yaml` | Tests registry (0.2.19) -- every tests/**/*.test.* or .spec.*; feature mapping from features/*/TEST-MANIFEST.yaml; doctor warns on orphans under tests/{expect,e2e,integration}/ |
| `.ai-dev-kit/registries/tools.yaml` | LLM tool registry (auto-synced from lib/ai/tools/**; invocation_count from Langfuse aggregation) |

### Enforcement config

| Project path | Purpose |
|--------------|---------|
| `.ai-dev-kit/budget.yaml` | cost budget (per_run, per_day, per_month; soft/hard; enforced by scripts/check-budget.ts + auto-notify) |
| `.ai-dev-kit/observability-requirements.yaml` | dynamic wrapper + UI coverage rules (extend per-project) |

### Error boundaries

| Project path | Purpose |
|--------------|---------|
| `app/error.tsx` | route-level Next.js error boundary |
| `app/global-error.tsx` | global Next.js error boundary |

### Feature templates

| Project path | Purpose |
|--------------|---------|
| `features/_SEED-SPEC.md` | seed SPEC.md per feature -- lists acceptance criteria including the "design approved" gate (copy to features/<feature>/SPEC.md) |

### Git hooks

| Project path | Purpose |
|--------------|---------|
| `.husky/post-commit` | husky post-commit |
| `.husky/post-commit-tiered` | husky post-commit-tiered |
| `.husky/pre-commit` | husky pre-commit |
| `.husky/pre-commit-tiered` | husky pre-commit-tiered |
| `.husky/pre-push` | husky pre-push |
| `.husky/pre-push-tiered` | husky pre-push-tiered |

### Harness artifacts

| Project path | Purpose |
|--------------|---------|
| `.ai-dev-kit/review.md.template` | review.md template |
| `.ai-dev-kit/spec.md.template` | spec.md template |
| `.ai-dev-kit/sprint.md.template` | sprint.md template |

### MCP servers

| Project path | Purpose |
|--------------|---------|
| `.mcp.json` | Context7 + Firecrawl + Playwright MCP servers auto-loaded at SessionStart |

### Notifications

| Project path | Purpose |
|--------------|---------|
| `.ai-dev-kit/notify.yaml` | ntfy config (topic + 4 channels + auto_events: done, blocked, eval_regression, cost_overrun, visual_diff) |

### Observability + utilities (lib/)

| Project path | Purpose |
|--------------|---------|
| `instrumentation.ts` | Next.js instrumentation with graceful degradation |
| `lib/ai-call.ts` | preferred AI SDK entry point -- aiCall() combines withTelemetry + logAICall + costMode + run_id in one call |
| `lib/dev-kit-theme.ts` | getDevKitTheme() -- reads .ai-dev-kit/registries/design-tokens.yaml and returns colors/font/space/radius for the /dev-kit dashboard; defaults (dark-mint) when the file is empty so the dashboard is always branded, never half-styled |
| `lib/dev-kit/starter-dashboard.ts` | dev-kit/starter-dashboard.ts |
| `lib/kit-audit.ts` | kit-audit writer -- append-only JSONL at .ai-dev-kit/state/kit-audit.jsonl; ground truth of every CLI / husky / claude hook event for `ai-dev-kit audit export` bug reports (0.2.17) |
| `lib/langfuse-setup.ts` | Langfuse OTel setup (guarded) |
| `lib/log-aggregator.ts` | unified log view across stdout / file / Supabase / Langfuse / dev3000 (grouped by run_id) |
| `lib/logger.ts` | structured stdout logger (always on, never throws) |
| `lib/middleware-dev-kit.ts` | dashboard auth guard: DEV_KIT_DASHBOARD_SECRET required in prod (403 otherwise), token via ?token= or x-dev-kit-token header (timing-safe compare); exports devKitAuthGuard() for custom middleware composition |
| `lib/model-router.ts` | Claude-Code-subscription-aware gateway |
| `lib/notify.ts` | ntfy notifier (fire-and-forget; 3s timeout; auto_events: done, blocked, eval_regression, cost_overrun, visual_diff) |
| `lib/registry.ts` | typed vendor-registry loader + validModels() + assertValidModel() |
| `lib/run-context.ts` | run_id backbone -- startRun / getRunContext / endRun; every wrapper reads this so logs/tests/costs correlate to one feature build |
| `lib/sink-stats.ts` | in-memory event counts per sink (silent-sink detection) |
| `lib/ts` | AI tooling: ts |
| `lib/ts` | AI tooling: ts |
| `lib/tsx` | AI tooling: tsx |
| `lib/tsx` | AI tooling: tsx |
| `lib/tsx` | AI tooling: tsx |
| `lib/vendor-pricing.ts` | lookup vendor+model pricing from registries; estimateVendorCostUsd() powers per-call attributed cost for non-LLM APIs (AssemblyAI, Firecrawl, Deepgram) |
| `lib/with-external.ts` | wraps non-AI-SDK vendor calls with logging + Langfuse spans + estimated_cost_usd from vendor-pricing lookup |
| `lib/with-route.ts` | API route wrapper; returns JSON on error with x-request-id + run_id tag |
| `middleware.ts` | x-request-id injection + /dev-kit auth gate (delegates to lib/middleware-dev-kit) |

### Project config

| Project path | Purpose |
|--------------|---------|
| `env.local.template` | config file: env.local.template |
| `eslint.config.mjs` | config file: eslint.config.mjs |
| `vitest.config.ts` | config file: vitest.config.ts |
| `vitest.eval.config.ts` | config file: vitest.eval.config.ts |

### Project docs

| Project path | Purpose |
|--------------|---------|
| `CHANGELOG.md` | project changelog seed (Keep a Changelog format) |

### Sample code

| Project path | Purpose |
|--------------|---------|
| `lib/ai/tools/sample-tool` | sample: sample-tool |
| `lib/ai/tools/sample-tool` | sample: sample-tool |

### Scripts (scripts/)

| Project path | Purpose |
|--------------|---------|
| `scripts/check-brand-compliance.mts` | pre-push: LLM-as-judge pass over changed components vs brand-guide.md + style-guide.md (BRAND_SKIP=1 to bypass) |
| `scripts/check-brand-tokens.ts` | pre-commit: scans changed .tsx/.css for colors/fonts/spacing not declared in design-tokens.yaml (FAIL-CLOSED) |
| `scripts/check-budget.ts` | pre-push: sum run/day/month costs from logs, fail when hard_usd crossed |
| `scripts/check-code-review.mts` | pre-push: code-reviewer subagent over `git diff @{u}..HEAD` (diff capped at 8k tokens); fails on any security issue or score < 0.7; verdicts cached by sha256(diff); REVIEW_SKIP=1 to bypass |
| `scripts/check-compliance.ts` | pre-push: scans .husky/pre-push for || true on critical commands (vitest, playwright, doctor, eslint, tsc, check-*) |
| `scripts/check-cost-drift.mts` | weekly GH Action: Firecrawl registry pricing source_urls, compare scraped price to registered price (>2% drift → blocker notify) |
| `scripts/check-dependencies.ts` | check-dependencies.ts (run via pnpm or pre-commit) |
| `scripts/check-deprecations.ts` | check-deprecations.ts (run via pnpm or pre-commit) |
| `scripts/check-design-compliance.ts` | check-design-compliance.ts (run via pnpm or pre-commit) |
| `scripts/check-design-ready.ts` | check-design-ready.ts (run via pnpm or pre-commit) |
| `scripts/check-docs-lookup-coverage.ts` | check-docs-lookup-coverage.ts (run via pnpm or pre-commit) |
| `scripts/check-e2e-smoke.ts` | Playwright smoke test: loads every route, verifies /chat produces a tool call (customize selectors for your project) |
| `scripts/check-eval-regression.ts` | pre-push: promptfoo pass-rate vs last-committed baseline; regression → blocker |
| `scripts/check-expect-coverage.ts` | check-expect-coverage.ts (run via pnpm or pre-commit) |
| `scripts/check-feature-coverage.ts` | check-feature-coverage.ts (run via pnpm or pre-commit) |
| `scripts/check-impl-doc-diff.mts` | opt-in pre-push: re-fetches Context7 docs for flagged libraries touched in the diff, @impl-doc-diff subagent LLM-diffs impl vs current docs; enabled via IMPL_DOC_DIFF=1 or requirements.yaml impl_doc_diff: required; IMPL_DOC_DIFF_SKIP=1 to bypass |
| `scripts/check-manifest-drift.ts` | check-manifest-drift.ts (run via pnpm or pre-commit) |
| `scripts/check-million.ts` | pre-push: verifies million.js (v2 million/next or v3 million/compiler) compiled blocks appear in next build output |
| `scripts/check-registry-strings.ts` | check-registry-strings.ts (run via pnpm or pre-commit) |
| `scripts/check-tdd.ts` | pre-commit: enforces test-first -- sibling *.test must have a failing-then-passing history in this branch |
| `scripts/check-test-manifest-coverage.ts` | check-test-manifest-coverage.ts (run via pnpm or pre-commit) |
| `scripts/generate-expect-from-manifest.ts` | generate-expect-from-manifest.ts (run via pnpm or pre-commit) |
| `scripts/generate-playwright-from-manifest.ts` | generate-playwright-from-manifest.ts (run via pnpm or pre-commit) |
| `scripts/generate-secrets-md.ts` | generate-secrets-md.ts (run via pnpm or pre-commit) |
| `scripts/generate-theme-css.ts` | pre-commit: design-tokens.yaml -> app/styles/tokens.css + tokens.tailwind.ts (YAML source of truth; CSS auto-generated) |
| `scripts/ingest-run-results.mjs` | ingest-run-results.mjs (run via pnpm or pre-commit) |
| `scripts/lib/kit-audit.sh` | kit-audit bash helper sourced by .husky/pre-commit + pre-push -- logs each step outcome + duration to .ai-dev-kit/state/kit-audit.jsonl (0.2.17) |
| `scripts/lib/manifest-parser.ts` | lib/manifest-parser.ts (run via pnpm or pre-commit) |
| `scripts/lib/test-reporters/playwright-kit-reporter.ts` | lib/test-reporters/playwright-kit-reporter.ts (run via pnpm or pre-commit) |
| `scripts/lib/test-reporters/vitest-kit-reporter.ts` | lib/test-reporters/vitest-kit-reporter.ts (run via pnpm or pre-commit) |
| `scripts/react-scan-check.mjs` | pre-push: boots dev server + runs react-scan CI over every route in pages.yaml |
| `scripts/scaffold-expect-tests.ts` | scaffold-expect-tests.ts (run via pnpm or pre-commit) |
| `scripts/scaffold-vendor-tests.ts` | onboard: emits tests/integration/<vendor>.live.test.ts skeleton per vendor registry |
| `scripts/setup-dev-tools.sh` | setup-dev-tools.sh (run via pnpm or pre-commit) |
| `scripts/sync-dependencies.ts` | sync-dependencies.ts (run via pnpm or pre-commit) |
| `scripts/sync-feature-manifest.ts` | sync-feature-manifest.ts (run via pnpm or pre-commit) |
| `scripts/sync-project-index.ts` | sync-project-index.ts (run via pnpm or pre-commit) |
| `scripts/sync-registries.ts` | scans codebase + state logs, refreshes components/pages/tools/skills registries (runs pre-commit) |
| `scripts/sync-test-contracts.ts` | sync-test-contracts.ts (run via pnpm or pre-commit) |

### Skills

| Project path | Purpose |
|--------------|---------|
| `.claude/skills/compliance-fix/SKILL.md` | compliance-fix skill -- auto-discovered by Claude Code |
| `.claude/skills/context7-first/SKILL.md` | context7-first skill -- auto-discovered by Claude Code |
| `.claude/skills/observability-debug/SKILL.md` | observability-debug skill -- auto-discovered by Claude Code |
| `.claude/skills/visual-qa/SKILL.md` | visual-qa skill -- auto-discovered by Claude Code |
| `.claude/skills/wire-telemetry/SKILL.md` | wire-telemetry skill -- auto-discovered by Claude Code |

### Slash commands

| Project path | Purpose |
|--------------|---------|
| `.claude/commands/cycle.md` | /cycle slash command |
| `.claude/commands/green.md` | /green slash command |
| `.claude/commands/kit-combine.md` | /kit-combine slash command |
| `.claude/commands/kit-create.md` | /kit-create slash command |
| `.claude/commands/kit-design.md` | /kit-design slash command |
| `.claude/commands/kit-run.md` | /kit-run slash command |
| `.claude/commands/kit-status.md` | /kit-status slash command |
| `.claude/commands/red.md` | /red slash command |
| `.claude/commands/refactor.md` | /refactor slash command |

### Subagents

| Project path | Purpose |
|--------------|---------|
| `.claude/agents/code-reviewer.md` | code-reviewer subagent (Sonnet) -- JSON verdict over a diff for security + perf + clarity + test gaps; invoked by scripts/check-code-review.mts at pre-push |
| `.claude/agents/design-agent.md` | design-agent subagent -- populates brand tokens, ASCII wireframes, and IA before any .tsx is written (pre-build gate) |
| `.claude/agents/evaluator` | evaluator subagent |
| `.claude/agents/impl-doc-diff.md` | impl-doc-diff subagent (Sonnet, opt-in) -- re-fetches Context7 after code lands on a flagged library and LLM-diffs impl vs current docs; enabled via IMPL_DOC_DIFF=1 or requirements.yaml impl_doc_diff: required |
| `.claude/agents/interview-researcher.md` | interview-researcher subagent (Haiku) -- reads Phase A interview answers + fetches Context7 docs for declared APIs, emits follow-up questions derived from actual docs (Phase B of ai-dev-kit interview) |
| `.claude/agents/planner` | planner subagent |
| `.claude/agents/spec-enricher` | spec-enricher subagent |

### Supabase

| Project path | Purpose |
|--------------|---------|
| `supabase/migrations/00001_ai_dev_kit_schema.sql` | Supabase asset: migrations/00001_ai_dev_kit_schema.sql |

### Test infrastructure

| Project path | Purpose |
|--------------|---------|
| `playwright.config.ts` | Playwright config with 4 viewport/theme projects + video recording |

### Test templates

| Project path | Purpose |
|--------------|---------|
| `tests/api/route-smoke.test.ts` | api/route-smoke.test.ts |
| `tests/integration/live-vendor.test.ts.example` | integration/live-vendor.test.ts.example |
| `tests/visual/README.md` | visual/README.md |
| `tests/visual/visual.sample.spec.ts` | visual/visual.sample.spec.ts |

### Vendor registries

| Project path | Purpose |
|--------------|---------|
| `.ai-dev-kit/registries/dependencies.yaml` | vendor registry: dependencies.yaml |
| `.ai-dev-kit/registries/index.yaml` | vendor registry: index.yaml |
| `.ai-dev-kit/registries/README.md` | how-to-add-a-vendor docs |
| `.ai-dev-kit/registries/registry.schema.json` | registry JSON Schema (vendors + pricing block) |
| `.ai-dev-kit/registries/test-contracts.yaml` | vendor registry: test-contracts.yaml |

<!-- KIT-CATALOG:END -->
