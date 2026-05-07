# Local Model Testing with Ollama

> Status: Implemented
> Date: 2026-04-06
> Requires: Ollama installed, model pulled, running on localhost:11434

---

## Overview

Layers supports running AI models locally via Ollama for development and testing. Local models run entirely on your machine — no API costs, no internet required, no data leaves your device.

Currently configured: **Gemma 4 26B** (Google, 17GB, Q4_K_M quantization)

---

## How It Works

```
Developer's Machine
  |
  ├── Next.js dev server (localhost:3204)
  |     |
  |     ├── Chat route receives message
  |     ├── Detects model ID starts with "ollama/"
  |     ├── Skips: credentials, MCP, rules, prompt cache, compaction
  |     ├── Uses slim system prompt (~100 tokens vs ~10,000)
  |     ├── Calls Ollama via ollama-ai-provider-v2
  |     └── Streams response back to UI
  |
  └── Ollama server (localhost:11434)
        |
        └── Gemma 4 26B loaded in GPU memory (17GB VRAM)
```

### What Gets Skipped for Local Models

The chat route has a fast path for local models that skips expensive operations:

| Step | Cloud Models | Local Models | Why Skip |
|------|-------------|-------------|----------|
| Auth + org lookup | Yes | Yes | Still needed for DB access |
| Credentials loading | Yes (Supabase query) | Skipped | No external services needed |
| API client init (5 services) | Yes | Skipped | Granola, Linear, Notion, Gmail, Drive |
| Tool permissions | Yes (Supabase query) | Skipped | Not enforced locally |
| MCP server connections | Yes (Supabase + handshakes) | Skipped | Slow, unnecessary for dev |
| Rules / priority docs | Yes (2 Supabase queries) | Skipped | Not needed for simple testing |
| System prompt (~10K tokens) | Full prompt | Slim (~100 tokens) | Reduces prefill time dramatically |
| Compaction middleware | Yes | Skipped | Smaller context, simpler pipeline |
| Artifact context lookup | Yes (2 Supabase queries) | Skipped | Not needed for basic testing |
| Prompt caching | Yes (gateway auto) | Skipped | No caching on local Ollama |

**Result:** Cloud request setup: ~200-500ms. Local request setup: ~30-50ms.

### Model Keep-Alive

Ollama unloads models from GPU memory after 5 minutes of inactivity by default. Loading a 17GB model from disk takes 15-20 seconds.

**Fix:** On the first local model request, the chat route calls a warmup function that sends `keep_alive: -1` to Ollama, telling it to never unload the model. The model stays in GPU memory until Ollama is restarted.

```typescript
// src/lib/ai/ollama-warmup.ts
// Pings Ollama with keep_alive: "24h" on first request
// Model stays resident — subsequent requests are instant
```

To manually unload the model (free GPU memory):
```bash
curl http://localhost:11434/api/generate -d '{"model":"gemma4:26b","keep_alive":0}'
```

---

## Setup

### Prerequisites

```bash
# Install Ollama
brew install ollama

# Pull Gemma 4 26B
ollama pull gemma4:26b

# Verify
ollama list
# NAME          SIZE     MODIFIED
# gemma4:26b    17 GB    ...
```

### Install Provider

```bash
pnpm add ollama-ai-provider-v2
```

### How the Code Works

**Model selector** (`src/components/chat-interface.tsx`):
- Detects `localhost` via `window.location.hostname`
- Shows "Gemma 4 26B (Local)" option only on localhost
- Defaults to local model on dev, cloud model on production

**Chat route** (`src/app/api/chat/route.ts`):
- `isOllamaModel(modelId)` checks for `ollama/` prefix
- Dynamic import of `ollama-ai-provider-v2` (only loaded when needed)
- Warmup ping on first request to pin model in memory
- All tool definitions still sent to model (tools work with Gemma 4)

**Production safety:**
- Local models never appear in production model selector
- Server-side fallback: if `ollama/` model can't connect, request fails gracefully
- No Ollama dependency in production build

---

## Performance

Benchmarked on Apple Silicon (M-series):

| Metric | Gemma 4 26B (Local) | Cloud (Sonnet 4.6) |
|--------|--------------------|--------------------|
| Time to first token | ~250ms | ~500-1500ms |
| Tokens per second | ~65 tok/s | ~30-80 tok/s |
| Simple response ("hey") | ~1.5s warm | ~2-3s |
| Tool calling | Supported | Supported |
| Streaming | Supported | Supported |
| Cost per request | $0 | $0.001-0.05 |
| Cold start (model loading) | 15-20s | N/A |
| Warm (model in memory) | ~250ms TTFT | N/A |

### Why Local is Useful

1. **Free testing** — iterate on prompts, tools, UI without API costs
2. **Offline development** — no internet needed once model is pulled
3. **Privacy** — no data leaves your machine
4. **Speed** — TTFT is faster than cloud (no network round trip)
5. **Tool testing** — verify tool calling works before burning cloud credits

### Limitations

- Slower for long responses (consumer GPU vs data center GPU)
- No prompt caching (Ollama doesn't support it)
- Quality may differ from cloud models (26B vs 400B+ parameters)
- 17GB VRAM required (may compete with other GPU workloads)
- Not available in production deployment

---

## Adding More Local Models

To add another Ollama model:

1. Pull it: `ollama pull llama4:17b`
2. Add to `ALLOWED_MODELS` in `src/app/api/chat/route.ts`:
   ```typescript
   "ollama/llama4:17b",
   ```
3. Add to `LOCAL_MODELS` in `src/components/chat-interface.tsx`:
   ```typescript
   { id: "ollama/llama4:17b", label: "Llama 4 17B (Local)", tier: "local" },
   ```
4. Restart dev server

The model will appear in the selector on localhost only.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Connection refused" | Run `ollama serve` |
| 15-20s first response | Model loading from disk. Send a warmup ping: `curl http://localhost:11434/api/generate -d '{"model":"gemma4:26b","keep_alive":-1,"prompt":"ping"}'` |
| Out of memory | Close other GPU-intensive apps. Or use a smaller model: `ollama pull gemma3:12b` |
| Tool calling not working | Some models don't support tools. Gemma 4 26B does. Check with: `ollama show gemma4:26b` |
| Model not in selector | Only shows on localhost. Check `window.location.hostname` in browser console |
