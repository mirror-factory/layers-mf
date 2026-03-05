# Models & Providers

The AI Gateway's unified API provides flexibility, allowing you to switch between different AI models and providers without rewriting parts of your application.

## Key Concepts

- **Models**: AI algorithms that process input to generate responses (e.g., Grok 4.1, GPT-5.2, Claude Opus 4.5)
- **Providers**: Companies/services hosting models (e.g., xAI, OpenAI, Anthropic)

Models use format: `creator/model-name` (e.g., `openai/gpt-5.2`, `anthropic/claude-sonnet-4.5`)

## Specifying Models

### In AI SDK function call:

```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  prompt: 'Hello!',
});
```

### Using Gateway provider instance:

```typescript
import { gateway } from '@ai-sdk/gateway';
import { generateText } from 'ai';

const { text } = await generateText({
  model: gateway('openai/gpt-5.2'),
  prompt: 'Hello!',
});
```

### Custom provider instance:

```typescript
import { createGateway } from '@ai-sdk/gateway';

const myGateway = createGateway({
  apiKey: process.env.CUSTOM_API_KEY,
  baseURL: 'https://custom-proxy.example.com/v1',
});

const { text } = await generateText({
  model: myGateway('openai/gpt-5.2'),
  prompt: 'Hello!',
});
```

## Global Default Provider

Set in instrumentation.ts (Next.js):

```typescript
import { gateway } from '@ai-sdk/gateway';

globalThis.AI_SDK_DEFAULT_PROVIDER = gateway;

export function register() {}
```

Then use without specifying provider:

```typescript
const { text } = await generateText({
  model: 'openai/gpt-5.2',
  prompt: 'Hello!',
});
```

## Embeddings

```typescript
import { embed } from 'ai';

const { embedding } = await embed({
  model: 'openai/text-embedding-3-small',
  value: 'Hello world',
});
```

Or with Gateway provider:

```typescript
import { gateway } from '@ai-sdk/gateway';
import { embed } from 'ai';

const { embedding } = await embed({
  model: gateway.textEmbeddingModel('openai/text-embedding-3-small'),
  value: 'Hello world',
});
```

## Dynamic Model Discovery

### Via AI SDK:

```typescript
import { getAvailableModels } from '@ai-sdk/gateway';

const models = await getAvailableModels();
```

### Via REST API:

```
GET https://ai-gateway.vercel.sh/v1/models
```

Returns model info including: id, name, description, context_window, max_tokens, pricing, tags.

### Get provider endpoints for a model:

```
GET /v1/models/{creator}/{model}/endpoints
```

## Pricing Tiers

Some models have tiered pricing based on context size:

| Field | Description |
|-------|-------------|
| `cost` | Cost per token for this tier |
| `min` | Minimum token count (inclusive) |
| `max` | Maximum token count (exclusive) |
