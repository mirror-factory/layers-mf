/**
 * /dev-kit/runs/[run_id] -- the single pane of a feature build.
 *
 * Shows (tabs, all populated from one /api/dev-kit/runs/[run_id] fetch):
 *   - Summary     meta + totals (calls, cost LLM vs vendor, tests, duration)
 *   - AI calls    every logAICall for this run_id (model, prompt tokens,
 *                 completion tokens, cost, label, costMode)
 *   - Vendor APIs every withExternalCall (AssemblyAI, Firecrawl, etc.)
 *                 with per-call cost
 *   - Docs        Context7 / Firecrawl / WebFetch consulted
 *   - Skills      which .claude/skills/* invoked, how many times
 *   - Tests       Playwright / vitest / Promptfoo results tied to run
 *   - Verifications  .claude/hooks/state.json snapshot (what was proven)
 *
 * Server component: reads the project's design tokens on the server and
 * passes them to the client view. Every color/font/spacing/radius below
 * comes from the theme so the page reflects the project's brand.
 */
import { getDevKitTheme, type DevKitTheme } from '@/lib/dev-kit-theme';
import { RunView } from './run-view';

export default function RunPage({ params }: { params: Promise<{ run_id: string }> }) {
  const theme = getDevKitTheme();
  return <RunView params={params} theme={serializeTheme(theme)} />;
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
