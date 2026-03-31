import type { ReferenceFile } from "./types";

export interface MarketplaceSkill {
  slug: string;
  name: string;
  description: string;
  author: string;
  category: string;
  icon: string;
  source: string;
  tags: string[];
}

// Curated from skills.sh — includes the most popular/useful skills
export const SKILLS_REGISTRY: MarketplaceSkill[] = [
  // Vercel Official
  { slug: 'nextjs', name: 'Next.js', description: 'Build and debug Next.js applications with App Router', author: 'Vercel', category: 'development', icon: '▲', source: 'vercel-labs/agent-skills@nextjs', tags: ['react', 'nextjs', 'web'] },
  { slug: 'react-best-practices', name: 'React Best Practices', description: 'Write performant React components following Vercel patterns', author: 'Vercel', category: 'development', icon: '⚛️', source: 'vercel-labs/agent-skills@react', tags: ['react', 'performance'] },
  { slug: 'tailwind-v4', name: 'Tailwind CSS v4', description: 'CSS-first configuration, @theme, utility patterns', author: 'Vercel', category: 'development', icon: '🎨', source: 'vercel-labs/agent-skills@tailwind', tags: ['css', 'tailwind', 'styling'] },
  { slug: 'shadcn-ui', name: 'shadcn/ui', description: 'Component patterns, installation, forms with React Hook Form', author: 'Vercel', category: 'development', icon: '🧱', source: 'vercel-labs/agent-skills@shadcn-ui', tags: ['components', 'ui', 'forms'] },
  { slug: 'supabase-postgres', name: 'Supabase & Postgres', description: 'Database design, RLS policies, Supabase best practices', author: 'Vercel', category: 'development', icon: '⚡', source: 'vercel-labs/agent-skills@supabase', tags: ['database', 'postgres', 'supabase'] },
  { slug: 'vercel-deployment', name: 'Vercel Deployment', description: 'Deploy, configure, and optimize Vercel projects', author: 'Vercel', category: 'development', icon: '🚀', source: 'vercel-labs/agent-skills@vercel', tags: ['deploy', 'vercel', 'ci-cd'] },

  // Development
  { slug: 'typescript-expert', name: 'TypeScript Expert', description: 'Advanced TypeScript patterns, generics, type utilities', author: 'Community', category: 'development', icon: '📘', source: 'community/typescript-expert', tags: ['typescript', 'types'] },
  { slug: 'api-designer', name: 'API Designer', description: 'Design RESTful and GraphQL APIs with best practices', author: 'Community', category: 'development', icon: '🔌', source: 'community/api-designer', tags: ['api', 'rest', 'graphql'] },
  { slug: 'testing-expert', name: 'Testing Expert', description: 'Write unit, integration, and E2E tests with Vitest and Playwright', author: 'Community', category: 'development', icon: '🧪', source: 'community/testing', tags: ['testing', 'vitest', 'playwright'] },
  { slug: 'git-workflow', name: 'Git Workflow', description: 'Branch strategies, commit conventions, PR reviews', author: 'Community', category: 'development', icon: '🌿', source: 'community/git-workflow', tags: ['git', 'workflow', 'pr'] },
  { slug: 'docker-kubernetes', name: 'Docker & K8s', description: 'Containerize apps, Kubernetes configs, CI/CD pipelines', author: 'Community', category: 'development', icon: '🐳', source: 'community/docker-k8s', tags: ['docker', 'kubernetes', 'devops'] },
  { slug: 'security-auditor', name: 'Security Auditor', description: 'Audit code for vulnerabilities, OWASP top 10', author: 'Community', category: 'development', icon: '🔒', source: 'community/security', tags: ['security', 'audit', 'owasp'] },

  // Analysis
  { slug: 'seo-optimizer', name: 'SEO Optimizer', description: 'Optimize content for search engines, meta tags, schema', author: 'Community', category: 'analysis', icon: '📈', source: 'community/seo', tags: ['seo', 'marketing', 'content'] },
  { slug: 'data-analyzer', name: 'Data Analyzer', description: 'Analyze datasets, generate insights, create visualizations', author: 'Community', category: 'analysis', icon: '📊', source: 'community/data-analyzer', tags: ['data', 'analytics', 'charts'] },
  { slug: 'legal-reviewer', name: 'Legal Document Reviewer', description: 'Review contracts, terms, NDAs for red flags', author: 'Community', category: 'analysis', icon: '⚖️', source: 'community/legal', tags: ['legal', 'contracts', 'compliance'] },

  // Creative
  { slug: 'ux-reviewer', name: 'UX Reviewer', description: 'Review interfaces for usability and accessibility', author: 'Community', category: 'creative', icon: '🎯', source: 'community/ux-reviewer', tags: ['ux', 'design', 'accessibility'] },
  { slug: 'copywriter', name: 'Copywriter', description: 'Write marketing copy, headlines, CTAs, landing pages', author: 'Community', category: 'creative', icon: '✍️', source: 'community/copywriter', tags: ['copy', 'marketing', 'writing'] },
  { slug: 'pitch-deck', name: 'Pitch Deck Builder', description: 'Create investor pitch decks with structure and storytelling', author: 'Community', category: 'creative', icon: '🎪', source: 'community/pitch-deck', tags: ['pitch', 'investor', 'startup'] },

  // Communication
  { slug: 'social-media', name: 'Social Media Manager', description: 'Create social posts, plan campaigns, engagement strategies', author: 'Community', category: 'communication', icon: '📱', source: 'community/social-media', tags: ['social', 'marketing', 'content'] },
  { slug: 'email-marketing', name: 'Email Marketing', description: 'Design email campaigns, subject lines, A/B testing', author: 'Community', category: 'communication', icon: '📧', source: 'community/email-marketing', tags: ['email', 'marketing', 'campaigns'] },

  // Productivity
  { slug: 'meeting-facilitator', name: 'Meeting Facilitator', description: 'Plan agendas, facilitate discussions, track action items', author: 'Community', category: 'productivity', icon: '🗓️', source: 'community/meeting-facilitator', tags: ['meetings', 'facilitation', 'productivity'] },
  { slug: 'onboarding-guide', name: 'Onboarding Guide', description: 'Create employee onboarding flows and documentation', author: 'Community', category: 'productivity', icon: '👋', source: 'community/onboarding', tags: ['onboarding', 'hr', 'docs'] },
  { slug: 'prompt-engineer', name: 'Prompt Engineer', description: 'Design and optimize prompts for AI models', author: 'Community', category: 'development', icon: '🧠', source: 'community/prompt-engineer', tags: ['prompts', 'ai', 'llm'] },
];

export const SKILL_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'development', label: 'Development' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'creative', label: 'Creative' },
  { value: 'communication', label: 'Communication' },
  { value: 'productivity', label: 'Productivity' },
] as const;

export type SkillCategory = typeof SKILL_CATEGORIES[number]['value'];

export function searchSkills(query: string, category: SkillCategory = 'all'): MarketplaceSkill[] {
  let results = SKILLS_REGISTRY;

  if (category !== 'all') {
    results = results.filter(s => s.category === category);
  }

  if (!query.trim()) return results;

  const q = query.toLowerCase();
  return results.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.tags.some(t => t.includes(q)) ||
    s.category.includes(q) ||
    s.author.toLowerCase().includes(q)
  );
}

/** Live search the skills.sh marketplace API. Returns real results with install counts. */
export async function searchSkillsMarketplace(
  query: string,
  limit = 20,
): Promise<{ name: string; source: string; installs: number; id: string; installCommand: string; url: string }[]> {
  try {
    const res = await fetch(
      `https://skills.sh/api/search?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.skills ?? [])
      .slice(0, limit)
      .map((s: { name: string; source: string; installs: number; id: string }) => ({
        name: s.name,
        source: s.source,
        installs: s.installs,
        id: s.id,
        installCommand: `npx skills add ${s.source}`,
        url: `https://skills.sh/s/${s.id}`,
      }));
  } catch {
    return [];
  }
}

/** Format reference files as a context block for inclusion in system prompts. */
export function formatReferenceFilesContext(files: ReferenceFile[]): string {
  if (!files || files.length === 0) return "";

  const sections = files.map((file) => {
    const fence = file.type === "code" ? "```" : file.type === "markdown" ? "```markdown" : "```";
    return `<reference-file name="${file.name}" type="${file.type}">\n${fence}\n${file.content}\n${fence}\n</reference-file>`;
  });

  return `\n\n<reference-files>\n${sections.join("\n\n")}\n</reference-files>`;
}

/** Load reference files for a skill from the database. */
export async function getSkillReferenceFiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  skillId: string,
): Promise<ReferenceFile[]> {
  const { data, error } = await supabase
    .from("skills")
    .select("reference_files")
    .eq("id", skillId)
    .single();

  if (error || !data) return [];

  const files = data.reference_files;
  if (!Array.isArray(files)) return [];

  return files as ReferenceFile[];
}
