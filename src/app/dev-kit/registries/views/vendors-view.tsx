'use client';

/**
 * Vendors tab -- extracted verbatim from the pre-tabs page.tsx. Renders one
 * section per vendor registry, each with its slots + model tables.
 */

import type { RegistryEnvelope, ModelEntry } from './types';
import { palette } from './types';

function priceCell(m: ModelEntry): string {
  if (m.price_per_hour_usd != null)
    return `$${m.price_per_hour_usd.toFixed(2)}/hr${m.price_notes ? ' ' + m.price_notes : ''}`;
  if (m.input_price_per_million_usd != null && m.output_price_per_million_usd != null) {
    return `$${m.input_price_per_million_usd.toFixed(2)} / $${m.output_price_per_million_usd.toFixed(2)} per 1M`;
  }
  if (m.price_per_million_chars_usd != null)
    return `$${m.price_per_million_chars_usd.toFixed(2)} per 1M chars`;
  return '—';
}

export function VendorsView({ registries }: { registries: RegistryEnvelope[] }) {
  if (registries.length === 0) {
    return (
      <div style={{ fontFamily: 'system-ui', maxWidth: 900 }}>
        <p style={{ color: palette.textMuted }}>
          No vendor registries yet. Add one for each external API your project calls:
        </p>
        <pre
          style={{
            background: '#111',
            color: palette.primary,
            padding: 14,
            borderRadius: 4,
            overflowX: 'auto',
            fontFamily: palette.mono,
          }}
        >
{`ai-dev-kit registry add assemblyai
# in Claude Code:
@spec-enricher populate the assemblyai registry`}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: palette.textMuted, fontSize: 14, marginBottom: 24 }}>
        Source of truth for valid model IDs, pricing, and deprecation patterns.
        Pre-commit blocks hardcoded strings not in a registry.
      </p>

      {registries.map(reg => (
        <section
          key={reg.vendor ?? reg.path}
          style={{
            marginBottom: 36,
            border: `1px solid ${palette.border}`,
            borderRadius: 6,
            padding: 20,
            background: palette.surface,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 18, margin: 0, color: palette.text }}>
              {reg.label ?? reg.vendor ?? reg.path}
            </h2>
            <span
              style={{
                fontFamily: palette.mono,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 3,
                background: reg.stale ? '#f59e0b22' : '#22c55e22',
                color: reg.stale ? palette.warn : palette.ok,
              }}
            >
              {reg.stale
                ? `stale (${reg.ageDays}d)`
                : reg.ageDays !== undefined
                  ? `fresh (${reg.ageDays}d)`
                  : '—'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: palette.textMuted, marginBottom: 14 }}>
            {reg.docs_root && (
              <>
                docs:{' '}
                <a href={reg.docs_root} target="_blank" rel="noreferrer" style={{ color: palette.primary }}>
                  {reg.docs_root}
                </a>{' '}
                ·{' '}
              </>
            )}
            {reg.console_url && (
              <>
                console:{' '}
                <a href={reg.console_url} target="_blank" rel="noreferrer" style={{ color: palette.primary }}>
                  {reg.console_url}
                </a>{' '}
                ·{' '}
              </>
            )}
            validated {reg.validated_on ?? '—'}
          </div>
          {reg.required_env && reg.required_env.length > 0 && (
            <div style={{ fontSize: 12, marginBottom: 14, color: palette.text }}>
              <strong>Env: </strong>
              {reg.required_env.map(k => (
                <code
                  key={k}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    padding: '2px 6px',
                    marginRight: 6,
                    borderRadius: 3,
                    fontFamily: palette.mono,
                  }}
                >
                  {k}
                </code>
              ))}
            </div>
          )}

          {reg.slots &&
            Object.entries(reg.slots).map(([slotName, models]) => (
              <div key={slotName} style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 14, margin: '0 0 6px', color: palette.textMuted }}>
                  {slotName.replace('_models', ' models').replace(/_/g, ' ')}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: palette.textFaint }}>
                      <th>ID</th>
                      <th>Pricing</th>
                      <th>Use for</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(models as ModelEntry[]).map(m => (
                      <tr
                        key={m.id}
                        style={{
                          borderTop: `1px solid ${palette.border}`,
                          opacity: m.deprecated ? 0.5 : 1,
                        }}
                      >
                        <td style={{ padding: '6px 0', fontFamily: palette.mono, color: palette.text }}>
                          {m.id}
                        </td>
                        <td style={{ color: palette.text }}>{priceCell(m)}</td>
                        <td style={{ color: palette.textMuted }}>{m.use_for ?? '—'}</td>
                        <td>
                          <span
                            style={{
                              fontFamily: palette.mono,
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: m.deprecated ? '#ef444422' : '#22c55e22',
                              color: m.deprecated ? palette.error : palette.ok,
                            }}
                          >
                            {m.deprecated ? 'deprecated' : 'active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
