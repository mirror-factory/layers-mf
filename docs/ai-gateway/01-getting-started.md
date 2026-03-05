# Getting Started with AI Gateway

This quickstart will walk you through making an AI model request with Vercel's AI Gateway. While this guide uses the AI SDK, you can also integrate with the OpenAI SDK, Anthropic SDK, OpenResponses API, or other community frameworks.

## Setup

1. Create a new directory and initialize:
```bash
mkdir my-ai-project && cd my-ai-project
pnpm init
```

2. Install dependencies:
```bash
pnpm add ai dotenv tsx typescript @types/node
```

3. Get API Key:
- Go to the AI Gateway API Keys page in your Vercel dashboard
- Click "Create key" to generate a new API key
- Create a `.env.local` file:
```
AI_GATEWAY_API_KEY=your_key_here
```

4. Create `index.ts`:
```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  prompt: 'What is the capital of France?',
});

console.log(text);
```

5. Run:
```bash
npx tsx index.ts
```

## OpenAI-Compatible API

The AI Gateway provides OpenAI-compatible API endpoints:

- **Model Management**: List and retrieve available models
- **Chat Completions**: Support streaming, images, file attachments
- **Tool Calls**: Automatic or explicit tool selection
- **Multiple Languages**: TypeScript, Python, or REST API

## Anthropic-Compatible API

The AI Gateway provides Anthropic-compatible API endpoints:

- **Messages API**: Streaming and multi-turn conversations
- **Tool Calls**: Automatic or explicit tool selection
- **Extended Thinking**: Complex reasoning tasks
- **File Attachments**: Images and files
- **Multiple Languages**: TypeScript, Python, or REST API

## OpenResponses API

Open standard for AI model interactions:

- **Text Generation**: Generate text from prompts
- **Streaming**: Stream tokens as generated
- **Tool Calling**: Define callable tools
- **Reasoning**: Extended thinking for complex tasks
- **Provider Options**: Fallbacks and provider-specific settings
