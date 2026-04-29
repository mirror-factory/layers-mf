'use client';

import type { PageEntry, RegistryEnvelope } from './types';
import { Section, Table, THead, Row, Cell, Badge, EmptyState, RegistryHeader } from './table';

export function PagesView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="pages" />;

  return (
    <>
      {registries.map(reg => {
        const entries = reg.entries as PageEntry[];
        return (
        <Section
          key={reg.path}
          title={`Pages (${entries.length})`}
          stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
        >
          {entries.length === 0 ? (
            <EmptyState kind="pages" />
          ) : (
            <Table>
              <THead cols={['route', 'path', 'auth', 'owner', 'features']} />
              <tbody>
                {entries.map((e, i) => (
                  <Row key={`${e.route ?? 'p'}-${i}`}>
                    <Cell mono>{e.route ?? '—'}</Cell>
                    <Cell mono muted>
                      {e.path ?? '—'}
                    </Cell>
                    <Cell>
                      <Badge kind={e.auth === 'required' ? 'warn' : 'info'}>{e.auth ?? '—'}</Badge>
                    </Cell>
                    <Cell muted>{e.owner ?? '—'}</Cell>
                    <Cell muted>{e.features ?? '—'}</Cell>
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
