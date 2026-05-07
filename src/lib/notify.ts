/**
 * ntfy notifier -- send structured events to an ntfy.sh topic.
 *
 * ntfy (https://ntfy.sh) is a simple HTTP-based pub/sub that works with
 * zero auth for public topics and with basic-auth / bearer tokens for
 * private ones. Each project declares its topic in .ai-dev-kit/notify.yaml
 * so multiple projects can share an ntfy server without cross-talk.
 *
 * Design rules:
 *   1. Silent on config missing -- the kit must not crash because the
 *      user hasn't set up notifications.
 *   2. Non-blocking -- fire-and-forget POST. A notifier that blocks a
 *      hook is worse than no notifier.
 *   3. Structured -- always sends JSON-like metadata as ntfy headers
 *      so the receiving client can filter by priority / tags / project.
 *
 * Invocation:
 *   import { notify } from '@/lib/notify';
 *   await notify({ kind: 'blocker', title: 'Missing ASSEMBLYAI_API_KEY', body: '...' });
 *
 * Config file (.ai-dev-kit/notify.yaml):
 *   topic: mirror-factory-my-project
 *   server: https://ntfy.sh                  # optional; defaults to ntfy.sh
 *   auth_token_env: NTFY_AUTH_TOKEN          # optional; reads from process.env
 *   channels:
 *     blocker:  { priority: 5, tags: [warning, rotating_light] }
 *     progress: { priority: 3, tags: [gear] }
 *     summary:  { priority: 2, tags: [checkered_flag] }
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type NotifyKind = 'blocker' | 'progress' | 'summary' | 'heartbeat';

interface NotifyArgs {
  kind: NotifyKind;
  title: string;
  body: string;
  /** Optional click-through URL (PR, issue, dashboard page). */
  click?: string;
  /** Extra tags for filtering on the receiving side. */
  tags?: string[];
}

interface NotifyConfig {
  topic: string;
  server: string;
  auth_token_env?: string;
  channels: Record<NotifyKind, { priority: number; tags: string[] }>;
  /**
   * Auto-events: which lifecycle events automatically emit a notify() without
   * explicit calls in code. Populated from notify.yaml `auto_events:` list.
   * Supported keys: 'done', 'blocked', 'eval_regression', 'cost_overrun',
   * 'visual_diff', 'brand_fail'. Scripts that emit these events (pre-push,
   * check-eval-regression, check-budget, etc.) consult `isAutoEventEnabled`
   * before calling notify().
   *
   * Default: ['blocked'] only -- backward-compatible with 0.1.x. Projects
   * that want completion pings must add 'done' explicitly.
   */
  auto_events: string[];
}

export type AutoEvent =
  | 'done'
  | 'blocked'
  | 'eval_regression'
  | 'cost_overrun'
  | 'visual_diff'
  | 'brand_fail';

const DEFAULT_AUTO_EVENTS: AutoEvent[] = ['blocked'];

const DEFAULT_CHANNELS: NotifyConfig['channels'] = {
  blocker:   { priority: 5, tags: ['warning', 'rotating_light'] },
  progress:  { priority: 3, tags: ['gear'] },
  summary:   { priority: 2, tags: ['checkered_flag'] },
  heartbeat: { priority: 1, tags: ['heart'] },
};

function parseYaml(src: string): Partial<NotifyConfig> {
  // Minimal YAML -- enough for this config shape. We intentionally avoid
  // pulling in a YAML lib to keep the notifier a pure stdlib helper.
  const out: Record<string, unknown> = {};
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].replace(/#.*$/, '').trimEnd();
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const val = kv[2].trim();
      if (val === '') {
        // Nested object. Scan following indented lines.
        const nested: Record<string, unknown> = {};
        i++;
        while (i < lines.length && /^\s+/.test(lines[i])) {
          const child = lines[i].trim().match(/^([a-z_]+):\s*(.*)$/);
          if (child) {
            const v = child[2].trim();
            if (v.startsWith('{') && v.endsWith('}')) {
              // Inline object: { priority: 5, tags: [a, b] }
              nested[child[1]] = parseInlineObject(v);
            } else {
              nested[child[1]] = v;
            }
          }
          i++;
        }
        out[key] = nested;
        continue;
      }
      out[key] = val.replace(/^["']|["']$/g, '');
    }
    i++;
  }
  return out as Partial<NotifyConfig>;
}

function parseInlineObject(src: string): Record<string, unknown> {
  const inner = src.slice(1, -1);
  const out: Record<string, unknown> = {};
  for (const part of splitTopLevel(inner)) {
    const kv = part.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      out[kv[1]] = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    } else if (/^\d+$/.test(v)) {
      out[kv[1]] = Number(v);
    } else {
      out[kv[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function splitTopLevel(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  out.push(src.slice(start));
  return out.map(s => s.trim()).filter(Boolean);
}

function loadConfig(): NotifyConfig | null {
  const path = join(process.cwd(), '.ai-dev-kit', 'notify.yaml');
  if (!existsSync(path)) return null;
  try {
    const src = readFileSync(path, 'utf-8');
    const parsed = parseYaml(src);
    if (!parsed.topic) return null;
    const rawAuto = (parsed as Record<string, unknown>).auto_events;
    let auto: string[];
    if (Array.isArray(rawAuto)) {
      auto = rawAuto.map(x => String(x));
    } else if (typeof rawAuto === 'string') {
      // Inline list: "[done, blocked]"
      auto = rawAuto.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
    } else {
      auto = DEFAULT_AUTO_EVENTS;
    }
    return {
      topic: String(parsed.topic),
      server: String(parsed.server ?? 'https://ntfy.sh'),
      auth_token_env: parsed.auth_token_env as string | undefined,
      channels: {
        ...DEFAULT_CHANNELS,
        ...((parsed.channels as NotifyConfig['channels']) ?? {}),
      },
      auto_events: auto,
    };
  } catch {
    return null;
  }
}

/**
 * Should this auto-event fire? Scripts that emit auto-events (pre-push,
 * check-eval-regression, check-budget, visual diff, etc.) gate their
 * notify() calls on this. Users opt in per-event via notify.yaml.
 *
 * ```ts
 * if (await isAutoEventEnabled('done')) await notify({ kind: 'summary', ... });
 * ```
 */
export function isAutoEventEnabled(event: AutoEvent): boolean {
  const cfg = loadConfig();
  if (!cfg) return false;
  return cfg.auto_events.includes(event);
}

/**
 * Fire-and-forget notification. Never throws, never blocks. Returns true
 * when a POST was dispatched, false when silently skipped (no config,
 * missing auth, network error).
 */
export async function notify(args: NotifyArgs): Promise<boolean> {
  const config = loadConfig();
  if (!config) return false;

  const channel = config.channels[args.kind] ?? DEFAULT_CHANNELS[args.kind];
  const url = `${config.server.replace(/\/$/, '')}/${encodeURIComponent(config.topic)}`;

  const headers: Record<string, string> = {
    Title: args.title,
    Priority: String(channel.priority),
    Tags: [...channel.tags, ...(args.tags ?? [])].join(','),
  };
  if (args.click) headers.Click = args.click;
  if (config.auth_token_env) {
    const token = process.env[config.auth_token_env];
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    // Intentionally not awaiting .catch chain result -- the caller should
    // not wait on remote delivery. ntfy delivery is best-effort by design.
    await fetch(url, {
      method: 'POST',
      headers,
      body: args.body,
      signal: AbortSignal.timeout(3_000),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the notifier is configured. Used by doctor to warn the
 * user when a Stop blocker happens with no notification channel configured
 * -- they'd never know the harness needs attention.
 */
export function isNotifyConfigured(): boolean {
  return loadConfig() !== null;
}
