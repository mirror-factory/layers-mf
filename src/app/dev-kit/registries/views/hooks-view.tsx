'use client';

/**
 * Hooks tab -- 0.2.19 signal view.
 *
 * Surfaces the two wiring signals kit-audit cares about:
 *   - `wired_in_settings` — true iff the hook is registered in
 *     .claude/settings.json / husky/ (i.e. will actually run).
 *   - `kit_audit_instrumented` — true iff the hook body emits kit-audit
 *     events so observability flows through.
 *
 * Filter: "unwired claude hooks only" narrows to Claude-surface hooks that
 * are missing settings wiring — the highest-priority fix list.
 */

import { useMemo, useState } from 'react';
import type { HookEntry, RegistryEnvelope } from './types';
import { palette, formatDate } from './types';
import { Section, Table, THead, Row, Cell, Badge, Check, EmptyState, RegistryHeader } from './table';

export function HooksView({ registries }: { registries: RegistryEnvelope[] }) {
  const [unwiredOnly, setUnwiredOnly] = useState(false);

  const allEntries = useMemo(
    () => registries.flatMap(r => (r.entries as HookEntry[]).map(e => ({ e, reg: r }))),
    [registries],
  );

  const stats = useMemo(() => {
    const total = allEntries.length;
    const wired = allEntries.filter(({ e }) => e.wired_in_settings).length;
    const instrumented = allEntries.filter(({ e }) => e.kit_audit_instrumented).length;
    return { total, wired, instrumented };
  }, [allEntries]);

  if (registries.length === 0) return <EmptyState kind="hooks" />;

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: palette.text, fontFamily: palette.mono }}>
          {stats.wired} wired, {stats.instrumented} instrumented, {stats.total} total
        </span>
        <label style={{ fontSize: 12, color: palette.textMuted, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={unwiredOnly}
            onChange={ev => setUnwiredOnly(ev.target.checked)}
          />
          unwired claude hooks only
        </label>
      </div>

      {registries.map(reg => {
        const all = reg.entries as HookEntry[];
        const entries = unwiredOnly
          ? all.filter(e => e.surface === 'claude' && !e.wired_in_settings)
          : all;
        return (
          <Section
            key={reg.path}
            title={`Hooks (${entries.length}${unwiredOnly ? ` of ${all.length}` : ''})`}
            stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
          >
            {entries.length === 0 ? (
              unwiredOnly ? (
                <div style={{ color: palette.ok, fontSize: 13, padding: 12, fontFamily: palette.mono }}>
                  All Claude hooks are wired.
                </div>
              ) : (
                <EmptyState kind="hooks" />
              )
            ) : (
              <Table>
                <THead cols={['name', 'surface', 'event', 'wired', 'instrumented', 'tool filter', 'last modified']} />
                <tbody>
                  {entries.map((e, i) => (
                    <Row key={`${e.name ?? 'h'}-${i}`}>
                      <Cell mono>{e.name ?? '—'}</Cell>
                      <Cell>
                        <Badge kind={e.surface === 'claude' ? 'info' : 'muted'}>
                          {e.surface ?? '—'}
                        </Badge>
                      </Cell>
                      <Cell mono muted>
                        {e.event ?? '—'}
                      </Cell>
                      <Cell>
                        <Check on={e.wired_in_settings} />
                      </Cell>
                      <Cell>
                        <Check on={e.kit_audit_instrumented} warnIfOff />
                      </Cell>
                      <Cell mono muted>
                        {e.tool_filter ?? '—'}
                      </Cell>
                      <Cell muted>{formatDate(e.last_modified)}</Cell>
                    </Row>
                  ))}
                </tbody>
              </Table>
            )}
          </Section>
        );
      })}
    </>
  );
}
