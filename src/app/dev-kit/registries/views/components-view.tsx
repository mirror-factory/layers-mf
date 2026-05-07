'use client';

/**
 * Components tab -- rows of components.yaml entries. Shows storybook +
 * visual-test wiring at a glance so gaps are obvious.
 */

import type { ComponentEntry, RegistryEnvelope } from './types';
import { palette } from './types';
import { Section, Table, THead, Row, Cell, Badge, EmptyState, RegistryHeader } from './table';

export function ComponentsView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="components" />;

  return (
    <>
      {registries.map(reg => {
        const entries = reg.entries as ComponentEntry[];
        return (
          <Section
            key={reg.path}
            title={`Components (${entries.length})`}
            stat={<RegistryHeader path={reg.path} last_synced_on={reg.last_synced_on} />}
          >
            {entries.length === 0 ? (
              <EmptyState kind="components" />
            ) : (
              <Table>
                <THead cols={['name', 'path', 'stories', 'visual', 'owner', 'status']} />
                <tbody>
                  {entries.map((e, i) => (
                    <Row key={`${e.name ?? 'c'}-${i}`}>
                      <Cell mono>{e.name ?? '—'}</Cell>
                      <Cell mono muted>
                        {e.path ?? '—'}
                      </Cell>
                      <Cell>
                        {e.stories_path ? (
                          <Badge kind="ok">✓</Badge>
                        ) : (
                          <Badge kind="muted">none</Badge>
                        )}
                      </Cell>
                      <Cell>
                        {e.visual_path ? (
                          <Badge kind="ok">✓</Badge>
                        ) : (
                          <Badge kind="muted">none</Badge>
                        )}
                      </Cell>
                      <Cell muted>{e.owner ?? '—'}</Cell>
                      <Cell>
                        <Badge kind={e.status === 'stable' ? 'ok' : 'info'}>{e.status ?? '—'}</Badge>
                      </Cell>
                    </Row>
                  ))}
                </tbody>
              </Table>
            )}
          </Section>
        );
      })}
      <p style={{ color: palette.textMuted, fontSize: 12 }}>
        Components drive Storybook previews and visual regression. Missing stories or visuals are
        candidates for follow-up.
      </p>
    </>
  );
}
