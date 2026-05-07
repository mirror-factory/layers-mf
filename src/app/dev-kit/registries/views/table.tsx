'use client';

/**
 * Shared table primitives for registry views. Keeps each view ~60-120 lines
 * by pulling table chrome (header, empty rows, cell styling) up here.
 */

import type { ReactNode } from 'react';
import { palette } from './types';

export function Section({
  title,
  stat,
  children,
}: {
  title: string;
  stat?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 32,
        border: `1px solid ${palette.border}`,
        borderRadius: 6,
        padding: 20,
        background: palette.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0, color: palette.text }}>{title}</h2>
        {stat && <span style={{ fontSize: 12, color: palette.textMuted }}>{stat}</span>}
      </div>
      {children}
    </section>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      {children}
    </table>
  );
}

export function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ textAlign: 'left', color: palette.textFaint }}>
        {cols.map(c => (
          <th key={c} style={{ padding: '4px 8px 8px 0', fontWeight: 500 }}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <tr style={{ borderTop: `1px solid ${palette.border}` }}>{children}</tr>;
}

export function Cell({
  children,
  mono,
  muted,
}: {
  children: ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      style={{
        padding: '8px 8px 8px 0',
        fontFamily: mono ? palette.mono : undefined,
        color: muted ? palette.textMuted : palette.text,
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
}

export function Badge({
  kind,
  children,
}: {
  kind: 'ok' | 'warn' | 'error' | 'info' | 'muted';
  children: ReactNode;
}) {
  const color =
    kind === 'ok'
      ? palette.ok
      : kind === 'warn'
        ? palette.warn
        : kind === 'error'
          ? palette.error
          : kind === 'info'
            ? palette.primary
            : palette.textFaint;
  return (
    <span
      style={{
        background: color + '22',
        color,
        padding: '2px 8px',
        borderRadius: 3,
        fontFamily: palette.mono,
        fontSize: 11,
      }}
    >
      {children}
    </span>
  );
}

export function Check({ on, warnIfOff = false }: { on: boolean | undefined; warnIfOff?: boolean }) {
  if (on) return <Badge kind="ok">✓</Badge>;
  return <Badge kind={warnIfOff ? 'warn' : 'error'}>✗</Badge>;
}

export function EmptyState({ kind }: { kind: string }) {
  return (
    <div style={{ padding: 20, color: palette.textMuted, fontSize: 13, fontFamily: palette.mono }}>
      No {kind} registered yet — run{' '}
      <code style={{ color: palette.primary }}>pnpm exec tsx scripts/sync-registries.ts</code>
    </div>
  );
}

export function RegistryHeader({
  path,
  last_synced_on,
}: {
  path: string;
  last_synced_on: string | null;
}) {
  return (
    <div
      style={{
        fontFamily: palette.mono,
        fontSize: 11,
        color: palette.textFaint,
        marginBottom: 10,
      }}
    >
      {path}
      {last_synced_on ? ` · synced ${last_synced_on}` : ' · never synced'}
    </div>
  );
}
