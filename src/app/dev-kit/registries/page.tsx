'use client';

/**
 * /dev-kit/registries -- every registry kind the sync tool emits, tabbed.
 *
 * Before v0.2.20 this page only rendered vendor JSON registries; all the
 * project-level YAML registries (components, pages, api-routes, tools,
 * skills, mcp-servers, hooks, docs, tests, design-tokens, design-system,
 * dependencies, test-contracts, index) were silently dropped or rendered
 * as broken vendor cards.
 *
 * Now: a top tab bar routes between per-kind views. Each view lives in
 * ./views/<kind>-view.tsx and accepts a filtered slice of the registries
 * array. Hash in the URL (`#hooks`, `#docs`, ...) deep-links to a tab.
 *
 * Fetch + loading + error handling stays here; the view components are pure
 * presenters that take already-filtered registries.
 */

import { useEffect, useMemo, useState } from 'react';
import type { RegistryEnvelope } from './views/types';
import { palette } from './views/types';
import { VendorsView } from './views/vendors-view';
import { ComponentsView } from './views/components-view';
import { PagesView } from './views/pages-view';
import { ApisView } from './views/apis-view';
import { ToolsView } from './views/tools-view';
import { SkillsView } from './views/skills-view';
import { McpsView } from './views/mcps-view';
import { HooksView } from './views/hooks-view';
import { DocsView } from './views/docs-view';
import { TestsView } from './views/tests-view';
import { DesignView } from './views/design-view';
import { RollupsView } from './views/rollups-view';

type TabId =
  | 'vendors'
  | 'components'
  | 'pages'
  | 'apis'
  | 'tools'
  | 'skills'
  | 'mcps'
  | 'hooks'
  | 'docs'
  | 'tests'
  | 'design'
  | 'rollups';

interface TabSpec {
  id: TabId;
  label: string;
  kinds: string[]; // registry kinds this tab owns
}

const TABS: readonly TabSpec[] = [
  { id: 'vendors', label: 'Vendors', kinds: ['vendor'] },
  { id: 'components', label: 'Components', kinds: ['components'] },
  { id: 'pages', label: 'Pages', kinds: ['pages'] },
  { id: 'apis', label: 'APIs', kinds: ['api-routes'] },
  { id: 'tools', label: 'Tools', kinds: ['tools'] },
  { id: 'skills', label: 'Skills', kinds: ['skills'] },
  { id: 'mcps', label: 'MCPs', kinds: ['mcp-servers'] },
  { id: 'hooks', label: 'Hooks', kinds: ['hooks'] },
  { id: 'docs', label: 'Docs', kinds: ['docs'] },
  { id: 'tests', label: 'Tests', kinds: ['tests'] },
  { id: 'design', label: 'Design', kinds: ['design-tokens', 'design-system'] },
  { id: 'rollups', label: 'Rollups', kinds: ['dependencies', 'test-contracts', 'index'] },
] as const;

function isTabId(v: string): v is TabId {
  return TABS.some(t => t.id === v);
}

export default function RegistriesPage() {
  const [data, setData] = useState<{ registries: RegistryEnvelope[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('vendors');

  useEffect(() => {
    fetch('/api/dev-kit/registries', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(`${r.status}`)))
      .then(setData)
      .catch(e => setErr(String(e)));
  }, []);

  // Hash routing: `#hooks` -> Hooks tab. Applied on mount + on back/forward.
  useEffect(() => {
    const applyFromHash = () => {
      const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
      if (raw && isTabId(raw)) setActiveTab(raw);
    };
    applyFromHash();
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', applyFromHash);
      return () => window.removeEventListener('hashchange', applyFromHash);
    }
    return undefined;
  }, []);

  const selectTab = (id: TabId) => {
    setActiveTab(id);
    if (typeof window !== 'undefined') {
      // Replace rather than push so the back button still exits the page.
      const url = `${window.location.pathname}#${id}`;
      window.history.replaceState(null, '', url);
    }
  };

  // Bucket registries by tab once per fetch.
  const bucketed = useMemo(() => {
    const out = Object.fromEntries(TABS.map(t => [t.id, [] as RegistryEnvelope[]])) as Record<
      TabId,
      RegistryEnvelope[]
    >;
    if (!data) return out;
    for (const reg of data.registries) {
      const tab = TABS.find(t => t.kinds.includes(reg.kind));
      if (tab) out[tab.id].push(reg);
    }
    return out;
  }, [data]);

  const entryCounts = useMemo(() => {
    const out = {} as Record<TabId, number>;
    for (const t of TABS) {
      // For Vendors tab, count registries (each vendor is a "card"); for
      // everything else, count entries inside the registries.
      out[t.id] =
        t.id === 'vendors'
          ? bucketed[t.id].length
          : bucketed[t.id].reduce((sum, r) => sum + (r.entries_count ?? r.entries.length), 0);
    }
    return out;
  }, [bucketed]);

  if (err) return <div style={{ padding: 24, color: palette.text }}>Error: {err}</div>;
  if (!data) return <div style={{ padding: 24, color: palette.text }}>Loading&hellip;</div>;

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 1200, color: palette.text }}>
      <h1 style={{ fontSize: 22, marginBottom: 8, marginTop: 0 }}>Registries</h1>
      <p style={{ color: palette.textMuted, fontSize: 13, marginBottom: 20 }}>
        Every registry `.ai-dev-kit/registries/*` emits. Tabs split by kind; hash-links deep-link to
        a tab (<code style={{ fontFamily: palette.mono, color: palette.primary }}>#hooks</code>,{' '}
        <code style={{ fontFamily: palette.mono, color: palette.primary }}>#docs</code>, …).
      </p>

      <div
        role="tablist"
        aria-label="Registry kinds"
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          borderBottom: `1px solid ${palette.border}`,
          marginBottom: 24,
        }}
      >
        {TABS.map(tab => {
          const count = entryCounts[tab.id];
          const isActive = activeTab === tab.id;
          const isEmpty = count === 0;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`registry-panel-${tab.id}`}
              id={`registry-tab-${tab.id}`}
              disabled={isEmpty}
              onClick={() => !isEmpty && selectTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '10px 14px',
                marginBottom: -1,
                cursor: isEmpty ? 'not-allowed' : 'pointer',
                fontFamily: palette.mono,
                fontSize: 13,
                color: isActive
                  ? palette.primary
                  : isEmpty
                    ? palette.textFaint
                    : palette.textMuted,
                opacity: isEmpty ? 0.5 : 1,
                borderBottom: `2px solid ${isActive ? palette.primary : 'transparent'}`,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`registry-panel-${activeTab}`}
        aria-labelledby={`registry-tab-${activeTab}`}
      >
        {renderPanel(activeTab, bucketed)}
      </div>
    </div>
  );
}

function renderPanel(tab: TabId, bucketed: Record<TabId, RegistryEnvelope[]>) {
  switch (tab) {
    case 'vendors':
      return <VendorsView registries={bucketed.vendors} />;
    case 'components':
      return <ComponentsView registries={bucketed.components} />;
    case 'pages':
      return <PagesView registries={bucketed.pages} />;
    case 'apis':
      return <ApisView registries={bucketed.apis} />;
    case 'tools':
      return <ToolsView registries={bucketed.tools} />;
    case 'skills':
      return <SkillsView registries={bucketed.skills} />;
    case 'mcps':
      return <McpsView registries={bucketed.mcps} />;
    case 'hooks':
      return <HooksView registries={bucketed.hooks} />;
    case 'docs':
      return <DocsView registries={bucketed.docs} />;
    case 'tests':
      return <TestsView registries={bucketed.tests} />;
    case 'design':
      return <DesignView registries={bucketed.design} />;
    case 'rollups':
      return <RollupsView registries={bucketed.rollups} />;
  }
}
