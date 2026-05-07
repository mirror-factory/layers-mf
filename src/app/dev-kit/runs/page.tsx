/**
 * /dev-kit/runs -- list every feature build this project has done.
 *
 * Each row links to /dev-kit/runs/[run_id] for the full drill-down.
 *
 * Server component: reads the project's design tokens at render time so the
 * dashboard demonstrates the kit's brand enforcement. Passes the flat theme
 * to a client child that owns the fetch + state.
 */
import { getDevKitTheme, type DevKitTheme } from '@/lib/dev-kit-theme';
import { RunsList } from './runs-list';

export default function RunsPage() {
  const theme = getDevKitTheme();
  return <RunsList theme={serializeTheme(theme)} />;
}

// The client boundary can only receive plain data, so flatten the theme's
// callable helpers into the step values that the table actually uses.
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
