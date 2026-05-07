/**
 * AI Dev Kit Configuration for Layers
 *
 * Single source of truth for all module settings.
 * Run `ai-dev-kit doctor` after changes to verify configuration.
 */

import { defineConfig } from '@mirror-factory/ai-dev-kit/core';

export default defineConfig({
  project: {
    name: 'Layers',
    slug: 'layers',
    repo: 'mirror-factory/layers-mf',
    deployUrl: 'https://layers.hustletogether.com',
  },

  modules: ['core', 'gateway', 'observability', 'dashboard'],

  ai: {
    gateway: true,
    defaultModel: 'anthropic/claude-sonnet-4.6',
    fallbackChain: ['openai/gpt-4o', 'google/gemini-3-flash'],
    providers: ['anthropic', 'openai', 'google'],
    maxOutputTokens: 128_000,
    tools: {
      registryPath: 'src/lib/ai/tools/_metadata.ts',
      implementationPath: 'src/lib/ai/tools/',
    },
  },

  hooks: {
    // Phase B v0.4.0 adoption: start false; flip to true in Task 9
    // after Tier 1 wiring is verified end-to-end via Codex validation runs.
    useTieredRouting: false,
  },
});
