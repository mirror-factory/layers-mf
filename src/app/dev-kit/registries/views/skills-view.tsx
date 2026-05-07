'use client';

import type { RegistryEnvelope, SkillEntry } from './types';
import { Section, Table, THead, Row, Cell, Badge, EmptyState, RegistryHeader } from './table';
import { formatDate } from './types';

export function SkillsView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="skills" />;

  return (
    <>
      {registries.map(reg => {
        const entries = reg.entries as SkillEntry[];
        return (
        <Section
          key={reg.path}
          title={`Skills (${entries.length})`}
          stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
        >
          {entries.length === 0 ? (
            <EmptyState kind="skills" />
          ) : (
            <Table>
              <THead cols={['name', 'path', 'invocations', 'last invoked', 'last run', 'description']} />
              <tbody>
                {entries.map((e, i) => (
                  <Row key={`${e.name ?? 's'}-${i}`}>
                    <Cell mono>{e.name ?? '—'}</Cell>
                    <Cell mono muted>
                      {e.path ?? '—'}
                    </Cell>
                    <Cell>
                      <Badge kind={e.invocation_count && e.invocation_count > 0 ? 'info' : 'muted'}>
                        {e.invocation_count ?? 0}
                      </Badge>
                    </Cell>
                    <Cell muted>{formatDate(e.last_invoked_at)}</Cell>
                    <Cell mono muted>
                      {e.last_run_id ?? '—'}
                    </Cell>
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
