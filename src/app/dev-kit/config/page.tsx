/**
 * /dev-kit/config -- tabbed editor for the project-level YAML configs that
 * the kit treats as sources of truth.
 *
 * Server component: reads the design-tokens theme so the editor inherits the
 * project's brand. Passes the flattened theme + the editable allowlist to a
 * client child that owns fetch + state. This mirrors /dev-kit/runs' pattern.
 *
 * Auth: the middleware at lib/middleware-dev-kit.ts already gates every
 * /dev-kit/* path via DEV_KIT_DASHBOARD_SECRET. This page does not re-check.
 */
import { getDevKitTheme, type DevKitTheme } from '@/lib/dev-kit-theme';
import { ConfigEditor } from './config-editor';

// Keep in sync with /api/dev-kit/config (GET) + /api/dev-kit/config/[name]
// (POST). Duplicated on purpose so the server render can populate the tab
// list before any client fetch resolves.
const EDITABLE_SLUGS: ReadonlyArray<{ slug: string; path: string; label: string }> = [
  { slug: 'design-tokens', path: '.ai-dev-kit/registries/design-tokens.yaml', label: 'Design tokens' },
  { slug: 'design-system', path: '.ai-dev-kit/registries/design-system.yaml', label: 'Design system' },
  { slug: 'budget',        path: '.ai-dev-kit/budget.yaml',                   label: 'Budget' },
  { slug: 'notify',        path: '.ai-dev-kit/notify.yaml',                   label: 'Notify' },
  { slug: 'observability', path: '.ai-dev-kit/observability-requirements.yaml', label: 'Observability' },
  { slug: 'requirements',  path: '.ai-dev-kit/requirements.yaml',             label: 'Requirements' },
];

export default function ConfigPage() {
  const theme = getDevKitTheme();
  return (
    <ConfigEditor
      theme={serializeTheme(theme)}
      slugs={EDITABLE_SLUGS.map(s => ({ ...s }))}
    />
  );
}

function serializeTheme(theme: DevKitTheme) {
  return {
    colors: theme.colors,
    font: theme.font,
    space: {
      1: theme.space(1),
      2: theme.space(2),
      3: theme.space(3),
      4: theme.space(4),
      6: theme.space(6),
      8: theme.space(8),
    },
    radius: {
      sm: theme.radius('sm'),
      md: theme.radius('md'),
      lg: theme.radius('lg'),
    },
  };
}
