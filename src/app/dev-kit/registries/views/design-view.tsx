'use client';

/**
 * Design tab -- points users to /dev-kit/design-system for the rich view.
 * Shows a one-line summary of design-tokens + design-system yamls so the tab
 * isn't opaque.
 */

import Link from 'next/link';
import type { RegistryEnvelope } from './types';
import { palette } from './types';
import { Section, EmptyState, RegistryHeader } from './table';

export function DesignView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="design" />;

  const tokens = registries.find(r => r.kind === 'design-tokens');
  const system = registries.find(r => r.kind === 'design-system');

  return (
    <>
      <Section title="Design system">
        <p style={{ fontSize: 13, color: palette.text, marginTop: 0, marginBottom: 12 }}>
          {tokens ? `${tokens.entries_count} tokens declared` : 'no tokens yet'}
          {' · '}
          {system ? `${system.entries_count} primitives` : 'no primitives yet'}
          {tokens?.last_synced_on ? ` · last synced ${tokens.last_synced_on}` : ''}
        </p>
        <Link
          href="/dev-kit/design-system"
          style={{
            color: palette.primary,
            fontFamily: palette.mono,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Open /dev-kit/design-system →
        </Link>
      </Section>

      {tokens && (
        <Section title={`design-tokens (${tokens.entries_count})`}>
          <RegistryHeader path={tokens.path} last_synced_on={tokens.last_synced_on} />
          <div style={{ fontSize: 12, color: palette.textMuted }}>
            Rendered in the dedicated Design system page.
          </div>
        </Section>
      )}

      {system && (
        <Section title={`design-system (${system.entries_count})`}>
          <RegistryHeader path={system.path} last_synced_on={system.last_synced_on} />
          <div style={{ fontSize: 12, color: palette.textMuted }}>
            Rendered in the dedicated Design system page.
          </div>
        </Section>
      )}
    </>
  );
}
