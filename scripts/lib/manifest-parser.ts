#!/usr/bin/env tsx
/**
 * manifest-parser -- hand-written YAML subset parser + type definitions for
 * features/<name>/TEST-MANIFEST.yaml.
 *
 * Scope: the exact shape described in templates/.ai-dev-kit/schemas/
 * test-manifest.schema.json. Not a general YAML parser -- it handles
 * scalars, lists of scalars, nested objects, and literal block scalars (|,
 * >, >-) as the schema uses them. Parsing stays zero-dep so the generators
 * run in any project without a yaml dependency.
 *
 * Shared by:
 *   - generate-expect-from-manifest.ts
 *   - generate-playwright-from-manifest.ts
 *   - check-test-manifest-coverage.ts
 *   - check-manifest-drift.ts
 *   - sync-test-contracts.ts
 */

export type StepNavigate = { action: 'navigate'; to: string; description?: string };
export type StepClick = { action: 'click'; locator: string; description?: string };
export type StepType = { action: 'type'; locator: string; text: string; description?: string };
export type StepExpectVisible = { action: 'expect_visible'; locator: string; within_seconds?: number; description?: string };
export type StepExpectText = { action: 'expect_text'; locator: string; text: string; description?: string };
export type StepExpectTextContains = { action: 'expect_text_contains'; locator: string; substring: string; description?: string };
export type StepExpectTextGrows = { action: 'expect_text_grows'; locator: string; min_growth_chars?: number; within_seconds?: number; sample_ms?: number; description?: string };
export type StepExpectCountAtLeast = { action: 'expect_count_at_least'; locator: string; count: number; description?: string };
export type StepFeedAudioFixture = { action: 'feed_audio_fixture'; fixture: string; description?: string };
export type StepEscapeHatch = { action: 'escape_hatch'; reason: string; language: 'playwright' | 'expect'; code: string };

export type Step =
  | StepNavigate
  | StepClick
  | StepType
  | StepExpectVisible
  | StepExpectText
  | StepExpectTextContains
  | StepExpectTextGrows
  | StepExpectCountAtLeast
  | StepFeedAudioFixture
  | StepEscapeHatch;

export interface Flow {
  name: string;
  description?: string;
  preconditions?: Record<string, boolean>;
  tags?: string[];
  steps: Step[];
}

export interface Manifest {
  feature: string;
  version: number;
  description?: string;
  user_flows: Flow[];
  cost_budget?: { per_run_usd?: number };
  observability?: { required_run_tags?: string[] };
}

// ── Low-level line parser ──────────────────────────────────────────────

interface RawLine {
  indent: number;
  text: string;
  raw: string;
}

function tokenize(src: string): RawLine[] {
  const out: RawLine[] = [];
  for (const raw of src.split('\n')) {
    // Strip tab-as-indent (replace with 2 spaces, YAML does not allow tabs).
    const normalized = raw.replace(/\t/g, '  ');
    // Leave fully blank lines in place -- block scalars need them.
    if (!normalized.trim() || normalized.trim().startsWith('#')) {
      out.push({ indent: -1, text: '', raw: normalized });
      continue;
    }
    const match = normalized.match(/^(\s*)(.*)$/);
    const indent = match ? match[1].length : 0;
    const text = match ? match[2] : normalized;
    out.push({ indent, text, raw: normalized });
  }
  return out;
}

function coerceScalar(raw: string): unknown {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d+\.\d+$/.test(v)) return Number(v);
  // Strip surrounding quotes once; preserve inner content.
  const dq = v.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (dq) return dq[1].replace(/\\(.)/g, '$1');
  const sq = v.match(/^'((?:[^']|'')*)'$/);
  if (sq) return sq[1].replace(/''/g, "'");
  return v;
}

interface Cursor { i: number }

/**
 * Parse a block at a given minimum indent. Returns the value (object, list,
 * or scalar) and advances the cursor past the block.
 */
function parseBlock(lines: RawLine[], cur: Cursor, minIndent: number): unknown {
  // Skip blanks at the start.
  while (cur.i < lines.length && lines[cur.i].indent === -1) cur.i++;
  if (cur.i >= lines.length) return null;

  const first = lines[cur.i];
  if (first.indent < minIndent) return null;

  // List?
  if (first.text.startsWith('- ') || first.text === '-') {
    return parseList(lines, cur, first.indent);
  }
  // Mapping?
  if (/^[a-zA-Z_][\w-]*:(\s|$)/.test(first.text)) {
    return parseMap(lines, cur, first.indent);
  }
  // Bare scalar on a single line -- rare in our subset.
  cur.i++;
  return coerceScalar(first.text);
}

function parseList(lines: RawLine[], cur: Cursor, indent: number): unknown[] {
  const out: unknown[] = [];
  while (cur.i < lines.length) {
    const line = lines[cur.i];
    if (line.indent === -1) { cur.i++; continue; }
    if (line.indent < indent) break;
    if (line.indent > indent) break;
    if (!line.text.startsWith('-')) break;

    // The list item's body starts after "- ".
    const rest = line.text === '-' ? '' : line.text.slice(2);
    cur.i++;

    if (rest === '') {
      // Nested block beneath the dash.
      const nested = parseBlock(lines, cur, indent + 1);
      out.push(nested);
      continue;
    }

    // Could be: scalar, or inline key:value that opens a mapping.
    const kv = rest.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const valText = kv[2];
      const obj: Record<string, unknown> = {};
      if (valText === '' || valText === '|' || valText === '>' || valText === '>-' || valText === '|-' || valText === '>+' || valText === '|+') {
        if (valText === '' ) {
          const inner = parseBlock(lines, cur, indent + 2);
          obj[key] = inner;
        } else {
          obj[key] = parseBlockScalar(lines, cur, indent + 2, valText);
        }
      } else {
        obj[key] = coerceScalar(valText);
      }
      // Absorb further keys that belong to the same item (same indent + 2).
      while (cur.i < lines.length) {
        const nxt = lines[cur.i];
        if (nxt.indent === -1) { cur.i++; continue; }
        if (nxt.indent !== indent + 2) break;
        const kv2 = nxt.text.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
        if (!kv2) break;
        cur.i++;
        const k2 = kv2[1];
        const v2 = kv2[2];
        if (v2 === '') {
          obj[k2] = parseBlock(lines, cur, indent + 4);
        } else if (v2 === '|' || v2 === '>' || v2 === '>-' || v2 === '|-' || v2 === '>+' || v2 === '|+') {
          obj[k2] = parseBlockScalar(lines, cur, indent + 4, v2);
        } else {
          obj[k2] = coerceScalar(v2);
        }
      }
      out.push(obj);
    } else {
      out.push(coerceScalar(rest));
    }
  }
  return out;
}

function parseMap(lines: RawLine[], cur: Cursor, indent: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  while (cur.i < lines.length) {
    const line = lines[cur.i];
    if (line.indent === -1) { cur.i++; continue; }
    if (line.indent < indent) break;
    if (line.indent > indent) break;
    const kv = line.text.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!kv) break;
    cur.i++;
    const key = kv[1];
    const rest = kv[2];
    if (rest === '') {
      const nested = parseBlock(lines, cur, indent + 2);
      out[key] = nested;
    } else if (rest === '|' || rest === '>' || rest === '>-' || rest === '|-' || rest === '>+' || rest === '|+') {
      out[key] = parseBlockScalar(lines, cur, indent + 2, rest);
    } else {
      out[key] = coerceScalar(rest);
    }
  }
  return out;
}

/**
 * Block scalar handling (|, >, >-, |-). Sufficient for the schema's use --
 * long reason/code/description strings. Keeps linebreaks verbatim for `|`,
 * folds to spaces for `>`.
 */
function parseBlockScalar(lines: RawLine[], cur: Cursor, minIndent: number, indicator: string): string {
  const keep = indicator.startsWith('|');
  const chomp = indicator.endsWith('-') ? 'strip' : indicator.endsWith('+') ? 'keep' : 'clip';
  const parts: string[] = [];
  let blockIndent = -1;
  while (cur.i < lines.length) {
    const line = lines[cur.i];
    if (line.indent === -1) {
      parts.push('');
      cur.i++;
      continue;
    }
    if (blockIndent === -1) {
      if (line.indent < minIndent) break;
      blockIndent = line.indent;
    }
    if (line.indent < blockIndent) break;
    parts.push(line.raw.slice(blockIndent));
    cur.i++;
  }
  let joined: string;
  if (keep) {
    joined = parts.join('\n');
  } else {
    // Folded: blank lines separate paragraphs; non-blank consecutive lines
    // collapse to single spaces.
    const folded: string[] = [];
    let buf: string[] = [];
    for (const line of parts) {
      if (line === '') {
        if (buf.length) folded.push(buf.join(' '));
        buf = [];
        folded.push('');
      } else {
        buf.push(line);
      }
    }
    if (buf.length) folded.push(buf.join(' '));
    joined = folded.join('\n').replace(/\n\n+/g, '\n');
  }
  // Chomp trailing newlines.
  if (chomp === 'strip') joined = joined.replace(/\n+$/, '');
  else if (chomp === 'clip') joined = joined.replace(/\n+$/, '\n');
  return joined;
}

// ── Public entry ───────────────────────────────────────────────────────

export function parseManifest(src: string): Manifest {
  const lines = tokenize(src);
  const cur: Cursor = { i: 0 };
  const root = parseBlock(lines, cur, 0);
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error('manifest: root must be an object');
  }
  const obj = root as Record<string, unknown>;
  const manifest: Manifest = {
    feature: String(obj.feature ?? ''),
    version: Number(obj.version ?? 1),
    description: typeof obj.description === 'string' ? obj.description : undefined,
    user_flows: normalizeFlows(obj.user_flows),
  };
  if (obj.cost_budget && typeof obj.cost_budget === 'object') {
    const cb = obj.cost_budget as Record<string, unknown>;
    manifest.cost_budget = {
      per_run_usd: typeof cb.per_run_usd === 'number' ? cb.per_run_usd : undefined,
    };
  }
  if (obj.observability && typeof obj.observability === 'object') {
    const ob = obj.observability as Record<string, unknown>;
    manifest.observability = {
      required_run_tags: Array.isArray(ob.required_run_tags) ? ob.required_run_tags.map(String) : undefined,
    };
  }
  return manifest;
}

function normalizeFlows(raw: unknown): Flow[] {
  if (!Array.isArray(raw)) return [];
  const out: Flow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const flow: Flow = {
      name: String(r.name ?? ''),
      steps: normalizeSteps(r.steps),
    };
    if (typeof r.description === 'string') flow.description = r.description;
    if (r.preconditions && typeof r.preconditions === 'object') {
      const pc: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(r.preconditions as Record<string, unknown>)) {
        pc[k] = v === true || v === 'true';
      }
      flow.preconditions = pc;
    }
    if (Array.isArray(r.tags)) flow.tags = r.tags.map(String);
    out.push(flow);
  }
  return out;
}

function normalizeSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  const out: Step[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const action = String(r.action ?? '');
    // assignOptional only sets the key when the value is defined, so the
    // schema validator's "if description in obj, check it's a string" pass
    // doesn't trip on implicit undefined fields.
    const assignOptional = (obj: Record<string, unknown>, key: string, value: unknown): void => {
      if (value !== undefined) obj[key] = value;
    };
    switch (action) {
      case 'navigate': {
        const s: Record<string, unknown> = { action, to: String(r.to ?? '') };
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepNavigate);
        break;
      }
      case 'click': {
        const s: Record<string, unknown> = { action, locator: String(r.locator ?? '') };
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepClick);
        break;
      }
      case 'type': {
        const s: Record<string, unknown> = { action, locator: String(r.locator ?? ''), text: String(r.text ?? '') };
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepType);
        break;
      }
      case 'expect_visible': {
        const s: Record<string, unknown> = { action, locator: String(r.locator ?? '') };
        assignOptional(s, 'within_seconds', maybeNum(r.within_seconds));
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepExpectVisible);
        break;
      }
      case 'expect_text': {
        const s: Record<string, unknown> = { action, locator: String(r.locator ?? ''), text: String(r.text ?? '') };
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepExpectText);
        break;
      }
      case 'expect_text_contains': {
        const s: Record<string, unknown> = { action, locator: String(r.locator ?? ''), substring: String(r.substring ?? '') };
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepExpectTextContains);
        break;
      }
      case 'expect_text_grows': {
        const s: Record<string, unknown> = { action, locator: String(r.locator ?? '') };
        assignOptional(s, 'min_growth_chars', maybeNum(r.min_growth_chars));
        assignOptional(s, 'within_seconds', maybeNum(r.within_seconds));
        assignOptional(s, 'sample_ms', maybeNum(r.sample_ms));
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepExpectTextGrows);
        break;
      }
      case 'expect_count_at_least': {
        const s: Record<string, unknown> = { action, locator: String(r.locator ?? ''), count: Number(r.count ?? 1) };
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepExpectCountAtLeast);
        break;
      }
      case 'feed_audio_fixture': {
        const s: Record<string, unknown> = { action, fixture: String(r.fixture ?? '') };
        assignOptional(s, 'description', maybeStr(r.description));
        out.push(s as StepFeedAudioFixture);
        break;
      }
      case 'escape_hatch':
        out.push({
          action,
          reason: String(r.reason ?? ''),
          language: (r.language === 'expect' ? 'expect' : 'playwright'),
          code: String(r.code ?? ''),
        });
        break;
      default:
        // Unknown action -- skip silently. Schema validator is the gate.
        break;
    }
  }
  return out;
}

function maybeStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function maybeNum(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
