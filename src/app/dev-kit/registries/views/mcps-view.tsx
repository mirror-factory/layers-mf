'use client';

import type { McpServerEntry, RegistryEnvelope } from './types';
import { Section, Table, THead, Row, Cell, EmptyState, RegistryHeader } from './table';

export function McpsView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="mcp-servers" />;

  return (
    <>
      {registries.map(reg => {
        const entries = reg.entries as McpServerEntry[];
        return (
        <Section
          key={reg.path}
          title={`MCP servers (${entries.length})`}
          stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
        >
          {entries.length === 0 ? (
            <EmptyState kind="mcp-servers" />
          ) : (
            <Table>
              <THead cols={['name', 'command', 'args', 'required env', 'used by', 'description']} />
              <tbody>
                {entries.map((e, i) => (
                  <Row key={`${e.name ?? 'm'}-${i}`}>
                    <Cell mono>{e.name ?? '—'}</Cell>
                    <Cell mono>{e.command ?? '—'}</Cell>
                    <Cell mono muted>
                      {e.args ?? '—'}
                    </Cell>
                    <Cell mono muted>
                      {e.required_env ?? '—'}
                    </Cell>
                    <Cell muted>{e.used_by ?? '—'}</Cell>
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
