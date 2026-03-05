# Provider Options

AI Gateway can route your AI model requests across multiple AI providers with control over routing order and fallback behavior.

## Provider Routing Order

Use the `order` array to specify the sequence in which providers should be attempted:

```typescript
import { generateText } from 'ai';

const { text, experimental_providerMetadata } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  prompt: 'Hello!',
  experimental_providerOptions: {
    gateway: {
      order: ['bedrock', 'anthropic'],
    },
  },
});
```

In this example:
- First attempts Amazon Bedrock
- Falls back to Anthropic if Bedrock fails
- Other providers still available after specified ones

## Provider Metadata

Access provider info in the response:

```typescript
const { gateway } = experimental_providerMetadata;
console.log(gateway.cost);          // Amount debited from credits
console.log(gateway.marketCost);    // Market rate cost
console.log(gateway.generationId);  // Unique generation ID
console.log(gateway.provider);      // Provider that served request
```

## Restrict to Specific Providers

Use `only` to limit routing to specific providers:

```typescript
const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  prompt: 'Hello!',
  experimental_providerOptions: {
    gateway: {
      only: ['bedrock', 'anthropic'],
    },
  },
});
```

## Combining only and order

When both are provided, `only` filters first, then `order` sets priority:

```typescript
experimental_providerOptions: {
  gateway: {
    only: ['vertex', 'anthropic', 'bedrock'],
    order: ['vertex', 'bedrock', 'anthropic'],
  },
},
// Final order: vertex → bedrock → anthropic
```

## Combining with Provider-Specific Options

```typescript
const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  prompt: 'Hello!',
  experimental_providerOptions: {
    gateway: {
      only: ['vertex'],
    },
    anthropic: {
      thinkingBudget: 0.001, // $0.001 cost limit for thinking
    },
  },
});
```

## Request-Scoped BYOK

Pass your own credentials per request:

```typescript
experimental_providerOptions: {
  gateway: {
    byok: {
      anthropic: {
        apiKey: process.env.MY_ANTHROPIC_KEY,
      },
    },
  },
},
```

## Reasoning/Thinking Models

Configure reasoning behavior:

```typescript
const { text } = await generateText({
  model: 'openai/gpt-oss-120b',
  prompt: 'Solve this complex problem...',
  experimental_providerOptions: {
    openai: {
      reasoningEffort: 'high',
      reasoningSummary: 'detailed',
    },
  },
});
```

## Available Providers

| Slug | Name |
|------|------|
| `anthropic` | Anthropic |
| `openai` | OpenAI |
| `google` | Google |
| `bedrock` | Amazon Bedrock |
| `azure` | Azure |
| `vertex` | Vertex AI |
| `groq` | Groq |
| `mistral` | Mistral |
| `cohere` | Cohere |
| `deepseek` | DeepSeek |
| `fireworks` | Fireworks |
| `perplexity` | Perplexity |
| `togetherai` | Together AI |
| `xai` | xAI |
| `cerebras` | Cerebras |
| `deepinfra` | DeepInfra |
| `bfl` | Black Forest Labs |
| `recraft` | Recraft |
| `morph` | Morph |
