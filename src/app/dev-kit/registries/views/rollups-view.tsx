'use client';

/**
 * Rollups tab -- dependencies / test-contracts / index are meta-registries.
 * Show a small summary card each with last_synced_on + entries_count + a
 * link to the relevant dedicated dashboard page.
 */

import Link from 'next/link';
import type { RegistryEnvelope } from './types';
import { palette } from './types';
import { Section, EmptyState } from './table';

const LINKS: Record<string, { label: string; href: string }> = {
  dependencies: { label: 'Open /dev-kit/dependencies →', href: '/dev-kit/dependencies' },
  'test-contracts': { label: 'Open /dev-kit/features →', href: '/dev-kit/features' },
  index: { label: 'Open /dev-kit/index →', href: '/dev-kit/index' },
};

export function RollupsView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) return <EmptyState kind="rollups" />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      {registries.map(reg => {
        const link = LINKS[reg.kind];
        return (
          <Section key={reg.path} title={reg.kind}>
            <div style={{ fontSize: 12, color: palette.textMuted, fontFamily: palette.mono, marginBottom: 6 }}>
              {reg.path}
            </div>
            <div style={{ fontSize: 24, color: palette.text, fontFamily: palette.mono, margin: '4px 0' }}>
              {reg.entries_count}
            </div>
            <div style={{ fontSize: 12, color: palette.textMuted, marginBottom: 12 }}>
              {reg.last_synced_on ? `synced ${reg.last_synced_on}` : 'never synced'}
            </div>
            {link && (
              <Link
                href={link.href}
                style={{
                  color: palette.primary,
                  fontFamily: palette.mono,
                  fontSize: 12,
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </Link>
            )}
            {reg.parse_error && (
              <div style={{ marginTop: 10, fontSize: 11, color: palette.error, fontFamily: palette.mono }}>
                parse error: {reg.parse_error}
              </div>
            )}
          </Section>
        );
      })}
    </div>
  );
}
