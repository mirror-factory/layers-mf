'use client';

/**
 * Tests tab -- 0.2.19 tests.yaml surface.
 *
 * An "orphan" test file has no `feature` mapping -- it runs but is not tied
 * to a product feature, which means regressions won't bubble up correctly
 * on the features dashboard.
 */

import { useMemo, useState } from 'react';
import type { RegistryEnvelope, TestEntry } from './types';
import { palette, formatDate } from './types';
import { Section, Table, THead, Row, Cell, Badge, EmptyState, RegistryHeader } from './table';

function outcomeKind(outcome: string | null | undefined): 'ok' | 'warn' | 'error' | 'muted' {
  if (outcome === 'pass' || outcome === 'passed' || outcome === 'ok') return 'ok';
  if (outcome === 'fail' || outcome === 'failed' || outcome === 'error') return 'error';
  if (outcome === 'skipped' || outcome === 'pending') return 'warn';
  return 'muted';
}

export function TestsView({ registries }: { registries: RegistryEnvelope[] }) {
  const [orphansOnly, setOrphansOnly] = useState(false);

  const allEntries = useMemo(
    () => registries.flatMap(r => r.entries as TestEntry[]),
    [registries],
  );
  const stats = useMemo(() => {
    const total = allEntries.length;
    const mapped = allEntries.filter(e => e.feature && e.feature !== '').length;
    return { total, mapped, orphans: total - mapped };
  }, [allEntries]);

  if (registries.length === 0) return <EmptyState kind="tests" />;

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: palette.text, fontFamily: palette.mono }}>
          {stats.total} tests, {stats.mapped} feature-mapped, {stats.orphans} orphans
        </span>
        <label style={{ fontSize: 12, color: palette.textMuted, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={orphansOnly} onChange={ev => setOrphansOnly(ev.target.checked)} />
          orphans only
        </label>
      </div>

      {registries.map(reg => {
        const all = reg.entries as TestEntry[];
        const entries = orphansOnly
          ? all.filter(e => !e.feature || e.feature === '')
          : all;
        return (
          <Section
            key={reg.path}
            title={`Tests (${entries.length}${orphansOnly ? ` of ${all.length}` : ''})`}
            stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
          >
            {entries.length === 0 ? (
              orphansOnly ? (
                <div style={{ color: palette.ok, fontSize: 13, padding: 12, fontFamily: palette.mono }}>
                  Every test has a feature mapping.
                </div>
              ) : (
                <EmptyState kind="tests" />
              )
            ) : (
              <Table>
                <THead cols={['path', 'feature', 'last run', 'duration', 'outcome']} />
                <tbody>
                  {entries.map((e, i) => {
                    const hasFeature = !!e.feature && e.feature !== '';
                    return (
                      <Row key={`${e.path ?? 't'}-${i}`}>
                        <Cell mono>{e.path ?? '—'}</Cell>
                        <Cell>
                          {hasFeature ? (
                            <span style={{ fontFamily: palette.mono, color: palette.text }}>
                              {e.feature}
                            </span>
                          ) : (
                            <span style={{ color: palette.textFaint, fontFamily: palette.mono }}>
                              — orphan
                            </span>
                          )}
                        </Cell>
                        <Cell muted>
                          {e.last_run ? (
                            formatDate(e.last_run)
                          ) : (
                            <span style={{ color: palette.textFaint }}>never</span>
                          )}
                        </Cell>
                        <Cell mono muted>
                          {typeof e.last_duration_ms === 'number' ? `${e.last_duration_ms}ms` : '—'}
                        </Cell>
                        <Cell>
                          <Badge kind={outcomeKind(e.last_outcome)}>{e.last_outcome ?? '—'}</Badge>
                        </Cell>
                      </Row>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Section>
        );
      })}
    </>
  );
}
