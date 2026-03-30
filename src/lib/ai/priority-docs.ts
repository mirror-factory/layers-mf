import fs from 'fs/promises';
import path from 'path';

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
