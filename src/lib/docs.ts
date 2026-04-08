import fs from "fs";
import path from "path";

export type DocNode = {
  name: string;
  slug: string;
  path: string;
  isDirectory: boolean;
  children?: DocNode[];
};

const DOCS_ROOT = path.join(process.cwd(), "docs", "architecture");

function slugFromPath(filePath: string): string {
  const relative = path.relative(DOCS_ROOT, filePath);
  return relative
    .replace(/\.md$/, "")
    .replace(/README$/, "")
    .replace(/\/$/, "");
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/README/, "Overview")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildTree(dirPath: string): DocNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: DocNode[] = [];

  // Sort: directories first, then files; README first among files
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    if (a.name === "README.md") return -1;
    if (b.name === "README.md") return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const children = buildTree(fullPath);
      if (children.length > 0) {
        nodes.push({
          name: titleFromFilename(entry.name),
          slug: slugFromPath(fullPath),
          path: fullPath,
          isDirectory: true,
          children,
        });
      }
    } else if (entry.name.endsWith(".md")) {
      nodes.push({
        name: titleFromFilename(entry.name),
        slug: slugFromPath(fullPath),
        path: fullPath,
        isDirectory: false,
      });
    }
  }

  return nodes;
}

export function getDocTree(): DocNode[] {
  if (!fs.existsSync(DOCS_ROOT)) return [];
  return buildTree(DOCS_ROOT);
}

export function getDocContent(slug: string): { title: string; content: string } | null {
  // Empty slug = README.md (index)
  const targetPath = slug
    ? path.join(DOCS_ROOT, slug + ".md")
    : path.join(DOCS_ROOT, "README.md");

  // Try direct file first
  if (fs.existsSync(targetPath)) {
    const content = fs.readFileSync(targetPath, "utf-8");
    const title = extractTitle(content, slug);
    return { title, content };
  }

  // Try as directory index (README.md inside the directory)
  const indexPath = path.join(DOCS_ROOT, slug, "README.md");
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, "utf-8");
    const title = extractTitle(content, slug);
    return { title, content };
  }

  return null;
}

function extractTitle(content: string, fallbackSlug: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  const parts = fallbackSlug.split("/");
  return titleFromFilename(parts[parts.length - 1] || "Documentation");
}

export function getAllDocSlugs(): string[] {
  const slugs: string[] = [""];
  collectSlugs(DOCS_ROOT, slugs);
  return slugs;
}

function collectSlugs(dirPath: string, slugs: string[]): void {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectSlugs(fullPath, slugs);
    } else if (entry.name.endsWith(".md")) {
      const slug = slugFromPath(fullPath);
      if (slug) slugs.push(slug);
    }
  }
}
