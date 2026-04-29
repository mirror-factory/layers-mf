'use client';

/**
 * Docs tab -- 0.2.19 docs.yaml surface.
 *
 * Two health signals:
 *   - inbound_links === 0 -> orphan doc (nothing links in). Red unless the
 *     sync script flagged the doc as allowlisted (it strips the red via a
 *     non-zero inbound_links in that case).
 *   - outbound_links_broken > 0 -> rot. Red.
 */

import { useMemo, useState } from 'react';
import type { DocEntry, RegistryEnvelope } from './types';
import { palette, formatDate } from './types';
import { Section, Table, THead, Row, Cell, Badge, EmptyState, RegistryHeader } from './table';

export function DocsView({ registries }: { registries: RegistryEnvelope[] }) {
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [brokenOnly, setBrokenOnly] = useState(false);

  const allEntries = useMemo(
    () => registries.flatMap(r => r.entries as DocEntry[]),
    [registries],
  );

  const stats = useMemo(() => {
    const total = allEntries.length;
    const orphans = allEntries.filter(e => (e.inbound_links ?? 0) === 0).length;
    const broken = allEntries.filter(e => (e.outbound_links_broken ?? 0) > 0).length;
    return { total, orphans, broken };
  }, [allEntries]);

  if (registries.length === 0) return <EmptyState kind="docs" />;

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: palette.text, fontFamily: palette.mono }}>
          {stats.total} docs, {stats.orphans} orphans, {stats.broken} with broken outbound links
        </span>
        <label style={{ fontSize: 12, color: palette.textMuted, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={orphansOnly} onChange={ev => setOrphansOnly(ev.target.checked)} />
          orphans only
        </label>
        <label style={{ fontSize: 12, color: palette.textMuted, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={brokenOnly} onChange={ev => setBrokenOnly(ev.target.checked)} />
          broken links only
        </label>
      </div>

      {registries.map(reg => {
        const all = reg.entries as DocEntry[];
        const entries = all.filter(e => {
          if (orphansOnly && (e.inbound_links ?? 0) !== 0) return false;
          if (brokenOnly && (e.outbound_links_broken ?? 0) === 0) return false;
          return true;
        });
        return (
          <Section
            key={reg.path}
            title={`Docs (${entries.length}${entries.length !== all.length ? ` of ${all.length}` : ''})`}
            stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
          >
            {entries.length === 0 ? (
              <div style={{ color: palette.textMuted, fontSize: 13, padding: 12, fontFamily: palette.mono }}>
                No docs match the current filters.
              </div>
            ) : (
              <Table>
                <THead cols={['path', 'category', 'words', 'inbound', 'broken out', 'last modified']} />
                <tbody>
                  {entries.map((e, i) => {
                    const inbound = e.inbound_links ?? 0;
                    const broken = e.outbound_links_broken ?? 0;
                    return (
                      <Row key={`${e.path ?? 'd'}-${i}`}>
                        <Cell mono>{e.path ?? '—'}</Cell>
                        <Cell muted>{e.category ?? '—'}</Cell>
                        <Cell mono muted>
                          {e.word_count ?? 0}
                        </Cell>
                        <Cell>
                          <Badge kind={inbound === 0 ? 'error' : 'ok'}>{inbound}</Badge>
                        </Cell>
                        <Cell>
                          <Badge kind={broken > 0 ? 'error' : 'ok'}>{broken}</Badge>
                        </Cell>
                        <Cell muted>{formatDate(e.last_modified)}</Cell>
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
