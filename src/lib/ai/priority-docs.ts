import fs from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

const PRIORITY_DIR = path.join(process.cwd(), 'docs', 'priority');

export async function loadPriorityDocs(): Promise<string> {
  const files = await fs.readdir(PRIORITY_DIR);
  const mds = files.filter(f => f.endsWith('.md')).sort();
  const contents = await Promise.all(
    mds.map(async f => {
      const text = await fs.readFile(path.join(PRIORITY_DIR, f), 'utf-8');
      return `## ${f.replace('.md', '')}\n${text}`;
    })
  );
  return contents.join('\n\n---\n\n');
}

export type Rule = {
  id: string;
  org_id: string;
  text: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

export async function loadRules(
  supabase: SupabaseClient,
  orgId: string
): Promise<Rule[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    console.error('[priority-docs] failed to load rules:', error.message);
    return [];
  }
  return (data ?? []) as Rule[];
}

export function formatRulesForPrompt(rules: Rule[]): string {
  if (rules.length === 0) return '';
  const lines = rules.map(r => `- ${r.text}`).join('\n');
  return `\n\n## User Rules\nThe organization has defined these rules — you MUST follow them:\n${lines}\n`;
}
