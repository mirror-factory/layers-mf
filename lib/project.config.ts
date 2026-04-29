/**
 * AI Dev Kit Configuration
 *
 * Single source of truth for all module settings.
 * Edit this file to configure your AI Dev Kit installation.
 *
 * Run `ai-dev-kit doctor` after changes to verify configuration.
 */

import { defineConfig } from '@mirror-factory/ai-dev-kit';

export default defineConfig({
  project: {
    name: 'My AI App',
    slug: 'my-ai-app',
    repo: '',
    deployUrl: '',
  },

  modules: ['core', 'gateway', 'observability', 'dashboard'],

  ai: {
    gateway: true,
    defaultModel: 'anthropic/claude-sonnet-4-6',
    fallbackChain: [
      'anthropic/claude-sonnet-4-6',
      'anthropic/claude-haiku-4-5',
      'google/gemini-2.5-flash',
    ],
    providers: ['anthropic', 'openai', 'google'],
    maxOutputTokens: 128000,
    tools: {
      registryPath: 'lib/ai/tools/_metadata.ts',
      implementationPath: 'lib/ai/tools/',
    },
  },

  gateway: {
    costBudget: {
      daily: 50,
      monthly: 1000,
      perRequest: 2,
    },
    rateLimiting: {
      enabled: true,
      maxRequestsPerMinute: 60,
      maxTokensPerMinute: 100000,
    },
    fallbackOrder: [
      'anthropic/claude-sonnet-4-6',
      'anthropic/claude-haiku-4-5',
      'google/gemini-2.5-flash',
    ],
  },

  observability: {
    telemetry: true,
    supabaseSchema: true,
    realtimeUpdates: true,
    retentionDays: 90,
  },

  dashboard: {
    enabled: true,
    basePath: '/dev-kit',
    colorScheme: {
      bg: '#050505',
      fg: '#f0f0f0',
      accent: '#3dffc0',
      error: '#ef4444',
    },
  },

  testing: {
    evalThreshold: 85,
    patterns: [
      'tool-output-state',
      'registry-enforcement',
      'multi-step-chains',
      'error-scenarios',
    ],
    chaosEnabled: false,
  },

  enforcement: {
    preCommit: true,
    prePush: true,
    postCommit: true,
    ciGates: true,
  },

  contextBudget: {
    T1: 500,
    T2: 1000,
    T3: Infinity,
    gate: 2000,
  },
});
