'use client';

import type { RegistryEnvelope, ToolEntry } from './types';
import { Section, Table, THead, Row, Cell, Check, EmptyState, RegistryHeader } from './table';

export function ToolsView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="tools" />;

  return (
    <>
      {registries.map(reg => {
        const entries = reg.entries as ToolEntry[];
        return (
        <Section
          key={reg.path}
          title={`Tools (${entries.length})`}
          stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
        >
          {entries.length === 0 ? (
            <EmptyState kind="tools" />
          ) : (
            <Table>
              <THead cols={['name', 'path', 'has test', 'owner', 'description']} />
              <tbody>
                {entries.map((e, i) => (
                  <Row key={`${e.name ?? 't'}-${i}`}>
                    <Cell mono>{e.name ?? '—'}</Cell>
                    <Cell mono muted>
                      {e.path ?? '—'}
                    </Cell>
                    <Cell>
                      <Check on={e.has_test} warnIfOff />
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
