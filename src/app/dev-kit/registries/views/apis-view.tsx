'use client';

import type { ApiRouteEntry, RegistryEnvelope } from './types';
import { Section, Table, THead, Row, Cell, Badge, EmptyState, RegistryHeader } from './table';

export function ApisView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="api-routes" />;

  return (
    <>
      {registries.map(reg => {
        const entries = reg.entries as ApiRouteEntry[];
        return (
        <Section
          key={reg.path}
          title={`API routes (${entries.length})`}
          stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
        >
          {entries.length === 0 ? (
            <EmptyState kind="api-routes" />
          ) : (
            <Table>
              <THead cols={['method', 'route', 'path', 'auth', 'owner', 'description']} />
              <tbody>
                {entries.map((e, i) => (
                  <Row key={`${e.id ?? e.route ?? 'r'}-${i}`}>
                    <Cell mono>
                      <Badge kind="info">{e.method ?? '—'}</Badge>
                    </Cell>
                    <Cell mono>{e.route ?? '—'}</Cell>
                    <Cell mono muted>
                      {e.path ?? '—'}
                    </Cell>
                    <Cell>
                      <Badge kind={e.auth === 'required' ? 'warn' : 'info'}>{e.auth ?? '—'}</Badge>
                    </Cell>
                    <Cell muted>{e.owner ?? '—'}</Cell>
                    <Cell muted>{e.description ?? '—'}</Cell>
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
