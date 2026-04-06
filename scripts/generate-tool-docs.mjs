/**
 * Generate docs/generated/tools.md from src/lib/ai/tools/_metadata.ts
 *
 * Usage: node scripts/generate-tool-docs.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const metadataPath = resolve(
  ROOT,
  "src/lib/ai/tools/_metadata.ts",
);
const outputPath = resolve(ROOT, "docs/generated/tools.md");

// ---------------------------------------------------------------------------
// Parse TOOL_METADATA array from the TypeScript source
// ---------------------------------------------------------------------------

const source = readFileSync(metadataPath, "utf-8");

// Extract the array body between the opening [ and the matching ];
const marker = "ToolMetadata[] = [";
const markerPos = source.indexOf(marker);
if (markerPos === -1) {
  console.error("Could not find TOOL_METADATA array in _metadata.ts");
  process.exit(1);
}

// Skip past the "[] = [" to land on the array's opening bracket
const bracketStart = markerPos + marker.length - 1;
let depth = 0;
let bracketEnd = -1;
for (let i = bracketStart; i < source.length; i++) {
  if (source[i] === "[") depth++;
  if (source[i] === "]") depth--;
  if (depth === 0) {
    bracketEnd = i;
    break;
  }
}

const arrayBody = source.slice(bracketStart + 1, bracketEnd);

// Parse each object literal { ... } from the array
const tools = [];
const objectRegex = /\{([^}]+)\}/g;
let match;
while ((match = objectRegex.exec(arrayBody)) !== null) {
  const block = match[1];

  const getName = (key) => {
    const re = new RegExp(`${key}:\\s*"([^"]*)"`, "s");
    const m = block.match(re);
    return m ? m[1] : "";
  };

  const name = getName("name");
  const category = getName("category");
  const service = getName("service");
  const access = getName("access");
  const description = getName("description");

  if (name) {
    tools.push({ name, category, service, access, description });
  }
}

if (tools.length === 0) {
  console.error("No tools parsed from _metadata.ts");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Group by category
// ---------------------------------------------------------------------------

const byCategory = {};
for (const t of tools) {
  const cat = t.category;
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(t);
}

// Stable ordering of categories
const categoryOrder = [
  "knowledge",
  "agents",
  "code",
  "documents",
  "scheduling",
  "web",
  "skills",
  "compliance",
  "artifacts",
  "approvals",
];

// ---------------------------------------------------------------------------
// Render markdown
// ---------------------------------------------------------------------------

const timestamp = new Date().toISOString().split("T")[0];

let md = `# Tool Registry

> Auto-generated on ${timestamp}. Do not edit manually.
> Source: \`src/lib/ai/tools/_metadata.ts\`
> Regenerate: \`pnpm tools:generate\`

**${tools.length} tools** across ${Object.keys(byCategory).length} categories.

---

`;

for (const cat of categoryOrder) {
  const items = byCategory[cat];
  if (!items || items.length === 0) continue;

  const heading = cat.charAt(0).toUpperCase() + cat.slice(1);
  md += `## ${heading}\n\n`;
  md += `| Tool | Service | Access | Description |\n`;
  md += `|------|---------|--------|-------------|\n`;

  for (const t of items) {
    md += `| \`${t.name}\` | ${t.service} | ${t.access} | ${t.description} |\n`;
  }

  md += `\n`;
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, md, "utf-8");

console.log(
  `Generated ${outputPath} (${tools.length} tools, ${Object.keys(byCategory).length} categories)`,
);
