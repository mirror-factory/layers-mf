# Model Fallbacks

Configure model failover to specify backups that are tried in order if the primary model fails or is unavailable.

## Basic Model Fallbacks

Use the `models` array in providerOptions.gateway:

```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'openai/gpt-5.2', // Primary model
  prompt: 'Hello!',
  experimental_providerOptions: {
    gateway: {
      models: [
        'anthropic/claude-sonnet-4.5',  // First fallback
        'google/gemini-3-flash',        // Second fallback
      ],
    },
  },
});
```

Order:
1. First attempts `openai/gpt-5.2` (primary)
2. If fails, tries `anthropic/claude-sonnet-4.5`
3. If that fails, tries `google/gemini-3-flash`
4. Response comes from first successful model

## Combining with Provider Order

Use `models` together with `order` to control both model failover AND provider preference:

```typescript
const { text } = await generateText({
  model: 'openai/gpt-5.2',
  prompt: 'Hello!',
  experimental_providerOptions: {
    gateway: {
      order: ['azure', 'openai'],
      models: [
        'openai/gpt-5-nano',
        'anthropic/claude-sonnet-4.5',
      ],
    },
  },
});
```

This configuration:
1. Tries `openai/gpt-5.2` via Azure, then OpenAI
2. If both fail, tries `openai/gpt-5-nano` via Azure first, then OpenAI
3. If those fail, tries `anthropic/claude-sonnet-4.5` via available providers

## How It Works

1. Gateway routes request to primary model (the `model` parameter)
2. For each model, provider routing rules apply (`order` or `only` if specified)
3. If all providers for a model fail, gateway tries next model in `models` array
4. Response comes from first successful model/provider combination

## Checking Which Model Served

Check provider metadata to see which model and provider served your request:

```typescript
const { experimental_providerMetadata } = await generateText({...});
console.log(experimental_providerMetadata.gateway.provider);
console.log(experimental_providerMetadata.gateway.model);
```
