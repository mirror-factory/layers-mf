/**
 * AI Telemetry Middleware — Persistent observability for every AI call
 *
 * Three layers:
 * 1. `withTelemetry(model, ctx)` — wraps model, auto-injects experimental_telemetry
 * 2. `logAICall(params)` — persists structured log to storage
 * 3. `logError(params)` — persists error events (tool failures, stream drops, unhandled)
 *
 * Storage backends (choose one):
 * - **Supabase** (recommended for production): ai_logs + ai_errors tables
 * - **File-based** (dev/self-hosted): .ai-logs/ JSON files, one per day
 * - **In-memory** (testing only): array, lost on restart
 *
 * Set via env: AI_LOG_BACKEND=supabase | file | memory (default: file)
 *
 * Usage:
 *   import { withTelemetry, logAICall, logError } from '@/lib/ai/telemetry';
 *
 *   // In your route:
 *   const ctx = { userId: user.id, chatId, label: 'chat' };
 *   const model = withTelemetry(aiGateway('google/gemini-3-flash'), ctx);
 *   const startTime = Date.now();
 *
 *   try {
 *     const result = await streamText({ model, tools, ... });
 *     // After stream completes:
 *     await logAICall({ context: ctx, modelId: '...', usage: result.usage, ... });
 *   } catch (err) {
 *     await logError({ context: ctx, error: err, source: 'chat-route' });
 *   }
 */

import { type LanguageModel, wrapLanguageModel } from 'ai';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ── Types ─────────────────────────────────────────────────────────────

export interface TelemetryContext {
  userId?: string;
  sessionId?: string;
  chatId?: string;
  label?: string;
  metadata?: Record<string, string>;
}

export interface AILogRecord {
  id: string;
  timestamp: string;
  userId: string;
  sessionId: string;
  chatId: string;
  label: string;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  durationMs: number;
  ttftMs: number | null;
  steps: number;
  toolCalls: string[];
  cacheReadTokens: number;
  cacheWriteTokens: number;
  error: string | null;
  finishReason: string | null;
  // Streaming metrics
  tokensPerSecond: number | null;
  aborted: boolean;
}

export interface ErrorRecord {
  id: string;
  timestamp: string;
  userId: string;
  chatId: string;
  label: string;
  source: string; // 'chat-route' | 'tool-execute' | 'stream-drop' | 'middleware' | 'client'
  message: string;
  stack: string | null;
  modelId: string | null;
  toolName: string | null;
  metadata: Record<string, string>;
}

export interface HTTPLogRecord {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId: string | null;
  userAgent: string | null;
  ip: string | null;
}

// ── Cost Table ────────────────────────────────────────────────────────

const MODEL_COSTS: Record<string, [number, number]> = {
  'gemini-3-flash': [0.50, 3.00],
  'gemini-3.1-flash-lite': [0.25, 1.50],
  'gemini-3-pro': [2.00, 12.00],
  'gemini-3.1-pro-preview': [2.00, 12.00],
  'gemini-2.5-flash': [0.15, 0.60],
  'claude-opus-4-6': [15.00, 75.00],
  'claude-sonnet-4-6': [3.00, 15.00],
  'claude-haiku-4-5': [0.80, 4.00],
  'gpt-4.1': [2.00, 8.00],
  'gpt-4.1-mini': [0.40, 1.60],
  'gpt-4.1-nano': [0.10, 0.40],
  'o4-mini': [1.10, 4.40],
};

function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(MODEL_COSTS).find(k => modelId.includes(k));
  if (!key) return 0;
  const [inputCost, outputCost] = MODEL_COSTS[key];
  return (inputTokens * inputCost + outputTokens * outputCost) / 1_000_000;
}

// ── Storage Backend ───────────────────────────────────────────────────

const BACKEND = process.env.AI_LOG_BACKEND ?? 'file';
const LOG_DIR = process.env.AI_LOG_DIR ?? '.ai-logs';
const MAX_MEMORY_LOGS = 1000;

// In-memory fallback (also used as write-through cache for file backend)
const memoryLogs: AILogRecord[] = [];
const memoryErrors: ErrorRecord[] = [];
const memoryHTTP: HTTPLogRecord[] = [];

function todayFile(prefix: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(LOG_DIR, `${prefix}-${date}.json`);
}

function ensureLogDir() {
  if (BACKEND === 'file' && !existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function appendToFile<T>(prefix: string, record: T) {
  ensureLogDir();
  const file = todayFile(prefix);
  const existing: T[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : [];
  existing.push(record);
  writeFileSync(file, JSON.stringify(existing, null, 2));
}

function readFromFiles<T>(prefix: string, options?: { limit?: number; since?: string }): T[] {
  ensureLogDir();
  if (!existsSync(LOG_DIR)) return [];

  const files = readdirSync(LOG_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse(); // newest first

  const results: T[] = [];
  for (const file of files) {
    // Skip files older than 'since' date based on filename
    if (options?.since) {
      const fileDate = file.replace(`${prefix}-`, '').replace('.json', '');
      if (fileDate < options.since.split('T')[0]) break;
    }

    const records: T[] = JSON.parse(readFileSync(join(LOG_DIR, file), 'utf-8'));
    results.push(...records.reverse()); // newest first within file

    if (options?.limit && results.length >= options.limit) break;
  }

  return options?.limit ? results.slice(0, options.limit) : results;
}

// ── Supabase Backend ──────────────────────────────────────────────────

let supabaseClient: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null;

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (BACKEND !== 'supabase') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[telemetry] Supabase backend selected but missing env vars, falling back to file');
    return null;
  }

  const { createClient } = await import('@supabase/supabase-js');
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

// ── Persist Functions ─────────────────────────────────────────────────

async function persistAILog(record: AILogRecord) {
  // Always keep in memory (for fast reads in same process)
  memoryLogs.unshift(record);
  if (memoryLogs.length > MAX_MEMORY_LOGS) memoryLogs.pop();

  if (BACKEND === 'supabase') {
    const sb = await getSupabase();
    if (sb) {
      const { error } = await (sb as any).from('ai_logs').insert(record);
      if (error) console.error('[telemetry] Supabase insert error:', error.message);
    }
  } else if (BACKEND === 'file') {
    try { appendToFile('ai-logs', record); } catch (e) {
      console.error('[telemetry] File write error:', e);
    }
  }
}

async function persistError(record: ErrorRecord) {
  memoryErrors.unshift(record);
  if (memoryErrors.length > MAX_MEMORY_LOGS) memoryErrors.pop();

  if (BACKEND === 'supabase') {
    const sb = await getSupabase();
    if (sb) {
      const { error } = await (sb as any).from('ai_errors').insert(record);
      if (error) console.error('[telemetry] Supabase error insert:', error.message);
    }
  } else if (BACKEND === 'file') {
    try { appendToFile('ai-errors', record); } catch (e) {
      console.error('[telemetry] File write error:', e);
    }
  }
}

async function persistHTTPLog(record: HTTPLogRecord) {
  memoryHTTP.unshift(record);
  if (memoryHTTP.length > MAX_MEMORY_LOGS) memoryHTTP.pop();

  if (BACKEND === 'supabase') {
    const sb = await getSupabase();
    if (sb) {
      await (sb as any).from('http_logs').insert(record);
    }
  } else if (BACKEND === 'file') {
    try { appendToFile('http-logs', record); } catch (e) {
      // HTTP logs are high-volume, silently fail
    }
  }
}

// ── Query Functions (for dashboard API) ──────────────────────────────

export async function getLogs(options?: {
  userId?: string;
  chatId?: string;
  label?: string;
  limit?: number;
  since?: string;
  errorsOnly?: boolean;
}): Promise<AILogRecord[]> {
  const limit = options?.limit ?? 100;

  if (BACKEND === 'supabase') {
    const sb = await getSupabase();
    if (sb) {
      let query = sb.from('ai_logs').select('*').order('timestamp', { ascending: false }).limit(limit);
      if (options?.userId) query = query.eq('userId', options.userId);
      if (options?.chatId) query = query.eq('chatId', options.chatId);
      if (options?.label) query = query.eq('label', options.label);
      if (options?.since) query = query.gte('timestamp', options.since);
      if (options?.errorsOnly) query = query.not('error', 'is', null);
      const { data } = await query;
      return (data as AILogRecord[]) ?? [];
    }
  }

  if (BACKEND === 'file') {
    let records = readFromFiles<AILogRecord>('ai-logs', { limit: limit * 2, since: options?.since });
    if (options?.userId) records = records.filter(l => l.userId === options.userId);
    if (options?.chatId) records = records.filter(l => l.chatId === options.chatId);
    if (options?.label) records = records.filter(l => l.label === options.label);
    if (options?.errorsOnly) records = records.filter(l => l.error !== null);
    return records.slice(0, limit);
  }

  // Memory fallback
  let records = memoryLogs;
  if (options?.userId) records = records.filter(l => l.userId === options.userId);
  if (options?.chatId) records = records.filter(l => l.chatId === options.chatId);
  if (options?.label) records = records.filter(l => l.label === options.label);
  if (options?.errorsOnly) records = records.filter(l => l.error !== null);
  return records.slice(0, limit);
}

export async function getErrors(options?: {
  userId?: string;
  source?: string;
  limit?: number;
  since?: string;
}): Promise<ErrorRecord[]> {
  const limit = options?.limit ?? 50;

  if (BACKEND === 'supabase') {
    const sb = await getSupabase();
    if (sb) {
      let query = sb.from('ai_errors').select('*').order('timestamp', { ascending: false }).limit(limit);
      if (options?.userId) query = query.eq('userId', options.userId);
      if (options?.source) query = query.eq('source', options.source);
      if (options?.since) query = query.gte('timestamp', options.since);
      const { data } = await query;
      return (data as ErrorRecord[]) ?? [];
    }
  }

  if (BACKEND === 'file') {
    let records = readFromFiles<ErrorRecord>('ai-errors', { limit: limit * 2, since: options?.since });
    if (options?.userId) records = records.filter(e => e.userId === options.userId);
    if (options?.source) records = records.filter(e => e.source === options.source);
    return records.slice(0, limit);
  }

  let records = memoryErrors;
  if (options?.userId) records = records.filter(e => e.userId === options.userId);
  if (options?.source) records = records.filter(e => e.source === options.source);
  return records.slice(0, limit);
}

export async function getHTTPLogs(options?: {
  limit?: number;
  since?: string;
  status?: number;
}): Promise<HTTPLogRecord[]> {
  const limit = options?.limit ?? 100;

  if (BACKEND === 'file') {
    let records = readFromFiles<HTTPLogRecord>('http-logs', { limit: limit * 2, since: options?.since });
    if (options?.status) records = records.filter(r => r.status === options.status);
    return records.slice(0, limit);
  }

  return memoryHTTP.slice(0, limit);
}

export async function getStats(options?: { userId?: string; since?: string }) {
  const logs = await getLogs({ userId: options?.userId, since: options?.since, limit: 10000 });
  const errors = await getErrors({ userId: options?.userId, since: options?.since, limit: 10000 });

  const totalCost = logs.reduce((s, l) => s + l.cost, 0);
  const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
  const ttftValues = logs.filter(l => l.ttftMs !== null).map(l => l.ttftMs!);
  const avgTTFT = ttftValues.length > 0 ? ttftValues.reduce((a, b) => a + b, 0) / ttftValues.length : 0;
  const p95TTFT = ttftValues.length > 0 ? ttftValues.sort((a, b) => a - b)[Math.floor(ttftValues.length * 0.95)] : 0;

  const errorRate = logs.length > 0 ? (logs.filter(l => l.error !== null).length / logs.length) * 100 : 0;
  const abortRate = logs.length > 0 ? (logs.filter(l => l.aborted).length / logs.length) * 100 : 0;

  const modelBreakdown: Record<string, { calls: number; cost: number; tokens: number; avgTTFT: number }> = {};
  for (const l of logs) {
    if (!modelBreakdown[l.modelId]) modelBreakdown[l.modelId] = { calls: 0, cost: 0, tokens: 0, avgTTFT: 0 };
    const m = modelBreakdown[l.modelId];
    m.calls++;
    m.cost += l.cost;
    m.tokens += l.totalTokens;
    if (l.ttftMs !== null) m.avgTTFT = (m.avgTTFT * (m.calls - 1) + l.ttftMs) / m.calls;
  }

  // Cost per day (for charts)
  const costByDay: Record<string, number> = {};
  const callsByDay: Record<string, number> = {};
  const errorsByDay: Record<string, number> = {};
  for (const l of logs) {
    const day = l.timestamp.split('T')[0];
    costByDay[day] = (costByDay[day] ?? 0) + l.cost;
    callsByDay[day] = (callsByDay[day] ?? 0) + 1;
  }
  for (const e of errors) {
    const day = e.timestamp.split('T')[0];
    errorsByDay[day] = (errorsByDay[day] ?? 0) + 1;
  }

  // Tool frequency
  const toolFrequency: Record<string, number> = {};
  for (const l of logs) {
    for (const t of l.toolCalls) {
      toolFrequency[t] = (toolFrequency[t] ?? 0) + 1;
    }
  }

  // Session summaries (group by chatId)
  const sessions: Record<string, {
    chatId: string; userId: string; firstSeen: string; lastSeen: string;
    calls: number; cost: number; tokens: number; tools: string[]; errors: number;
  }> = {};
  for (const l of logs) {
    if (!sessions[l.chatId]) {
      sessions[l.chatId] = {
        chatId: l.chatId, userId: l.userId,
        firstSeen: l.timestamp, lastSeen: l.timestamp,
        calls: 0, cost: 0, tokens: 0, tools: [], errors: 0,
      };
    }
    const s = sessions[l.chatId];
    s.calls++;
    s.cost += l.cost;
    s.tokens += l.totalTokens;
    s.tools.push(...l.toolCalls);
    if (l.error) s.errors++;
    if (l.timestamp < s.firstSeen) s.firstSeen = l.timestamp;
    if (l.timestamp > s.lastSeen) s.lastSeen = l.timestamp;
  }
  // Dedupe tools per session
  for (const s of Object.values(sessions)) {
    s.tools = [...new Set(s.tools)];
  }

  return {
    totalCalls: logs.length,
    totalCost,
    totalTokens,
    avgTTFT,
    p95TTFT,
    errorRate,
    abortRate,
    totalErrors: errors.length,
    modelBreakdown,
    costByDay,
    callsByDay,
    errorsByDay,
    toolFrequency,
    sessions: Object.values(sessions).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    backend: BACKEND,
  };
}

// ── withTelemetry Middleware ───────────────────────────────────────────

export function withTelemetry(
  model: LanguageModel,
  context: TelemetryContext = {},
): LanguageModel {
  return wrapLanguageModel({
    model: model as any,
    middleware: {
      transformParams: async ({ params }: any) => ({
      ...params,
      experimental_telemetry: {
        isEnabled: true,
        functionId: context.label ?? 'unknown',
        metadata: {
          userId: context.userId ?? 'anonymous',
          sessionId: context.sessionId ?? 'unknown',
          chatId: context.chatId ?? 'unknown',
          ...(context.metadata ?? {}),
        },
      },
      }),
    } as any,
  }) as LanguageModel;
}

// ── logAICall ─────────────────────────────────────────────────────────

export async function logAICall(params: {
  context: TelemetryContext;
  modelId: string;
  usage: { promptTokens: number; completionTokens: number };
  durationMs: number;
  ttftMs?: number | null;
  steps?: number;
  toolCalls?: string[];
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  error?: string | null;
  finishReason?: string | null;
  tokensPerSecond?: number | null;
  aborted?: boolean;
}): Promise<AILogRecord> {
  const inputTokens = params.usage.promptTokens;
  const outputTokens = params.usage.completionTokens;

  const record: AILogRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    userId: params.context.userId ?? 'anonymous',
    sessionId: params.context.sessionId ?? 'unknown',
    chatId: params.context.chatId ?? 'unknown',
    label: params.context.label ?? 'unknown',
    provider: params.modelId.split('/')[0] ?? 'unknown',
    modelId: params.modelId,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: calculateCost(params.modelId, inputTokens, outputTokens),
    durationMs: params.durationMs,
    ttftMs: params.ttftMs ?? null,
    steps: params.steps ?? 1,
    toolCalls: params.toolCalls ?? [],
    cacheReadTokens: params.cacheReadTokens ?? 0,
    cacheWriteTokens: params.cacheWriteTokens ?? 0,
    error: params.error ?? null,
    finishReason: params.finishReason ?? null,
    tokensPerSecond: params.tokensPerSecond ?? null,
    aborted: params.aborted ?? false,
  };

  await persistAILog(record);
  return record;
}

// ── logError ──────────────────────────────────────────────────────────

export async function logError(params: {
  context?: TelemetryContext;
  error: unknown;
  source: 'chat-route' | 'tool-execute' | 'stream-drop' | 'middleware' | 'client' | string;
  modelId?: string;
  toolName?: string;
  metadata?: Record<string, string>;
}): Promise<ErrorRecord> {
  const err = params.error instanceof Error ? params.error : new Error(String(params.error));

  const record: ErrorRecord = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    userId: params.context?.userId ?? 'anonymous',
    chatId: params.context?.chatId ?? 'unknown',
    label: params.context?.label ?? 'unknown',
    source: params.source,
    message: err.message,
    stack: err.stack ?? null,
    modelId: params.modelId ?? null,
    toolName: params.toolName ?? null,
    metadata: params.metadata ?? {},
  };

  await persistError(record);
  return record;
}

// ── logHTTPRequest ────────────────────────────────────────────────────

export async function logHTTPRequest(params: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  const record: HTTPLogRecord = {
    id: `http-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    method: params.method,
    path: params.path,
    status: params.status,
    durationMs: params.durationMs,
    userId: params.userId ?? null,
    userAgent: params.userAgent ?? null,
    ip: params.ip ?? null,
  };

  await persistHTTPLog(record);
}

// ── Supabase Migration SQL ────────────────────────────────────────────
//
// Run this in your Supabase SQL editor to create the tables:
//
// CREATE TABLE ai_logs (
//   id TEXT PRIMARY KEY,
//   timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   "userId" TEXT NOT NULL,
//   "sessionId" TEXT,
//   "chatId" TEXT,
//   label TEXT,
//   provider TEXT,
//   "modelId" TEXT NOT NULL,
//   "inputTokens" INTEGER NOT NULL DEFAULT 0,
//   "outputTokens" INTEGER NOT NULL DEFAULT 0,
//   "totalTokens" INTEGER NOT NULL DEFAULT 0,
//   cost NUMERIC(10,6) NOT NULL DEFAULT 0,
//   "durationMs" INTEGER NOT NULL DEFAULT 0,
//   "ttftMs" INTEGER,
//   steps INTEGER NOT NULL DEFAULT 1,
//   "toolCalls" TEXT[] DEFAULT '{}',
//   "cacheReadTokens" INTEGER DEFAULT 0,
//   "cacheWriteTokens" INTEGER DEFAULT 0,
//   error TEXT,
//   "finishReason" TEXT,
//   "tokensPerSecond" NUMERIC(8,2),
//   aborted BOOLEAN DEFAULT FALSE
// );
//
// CREATE INDEX idx_ai_logs_timestamp ON ai_logs (timestamp DESC);
// CREATE INDEX idx_ai_logs_user ON ai_logs ("userId");
// CREATE INDEX idx_ai_logs_chat ON ai_logs ("chatId");
//
// CREATE TABLE ai_errors (
//   id TEXT PRIMARY KEY,
//   timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   "userId" TEXT,
//   "chatId" TEXT,
//   label TEXT,
//   source TEXT NOT NULL,
//   message TEXT NOT NULL,
//   stack TEXT,
//   "modelId" TEXT,
//   "toolName" TEXT,
//   metadata JSONB DEFAULT '{}'
// );
//
// CREATE INDEX idx_ai_errors_timestamp ON ai_errors (timestamp DESC);
//
// CREATE TABLE http_logs (
//   id TEXT PRIMARY KEY,
//   timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   method TEXT NOT NULL,
//   path TEXT NOT NULL,
//   status INTEGER NOT NULL,
//   "durationMs" INTEGER NOT NULL,
//   "userId" TEXT,
//   "userAgent" TEXT,
//   ip TEXT
// );
//
// CREATE INDEX idx_http_logs_timestamp ON http_logs (timestamp DESC);
// -- Auto-delete logs older than 30 days (optional):
// -- CREATE EXTENSION IF NOT EXISTS pg_cron;
// -- SELECT cron.schedule('cleanup-ai-logs', '0 3 * * *',
// --   $$DELETE FROM ai_logs WHERE timestamp < NOW() - INTERVAL '30 days'$$);
