import fs from "fs";
import path from "path";
import { formatDirName } from "./docs-shared";
import type { DocNode, DocHeading, DocCategory, FlatDoc } from "./docs-shared";

// Re-export shared types and utilities
export { formatDirName } from "./docs-shared";
export type { DocNode, DocHeading, DocCategory, FlatDoc } from "./docs-shared";

const DOCS_ROOT = path.join(process.cwd(), "docs", "architecture");

const CATEGORY_META: Record<string, { description: string; icon: string }> = {
  chat: {
    description: "Context engineering, media types, cost observability, and local model support.",
    icon: "MessageSquare",
  },
  artifacts: {
    description: "Universal artifact system, versioning, code and document editing.",
    icon: "Layers",
  },
  library: {
    description: "Content organization, ingestion pipelines, and the library hub.",
    icon: "Library",
  },
  sharing: {
    description: "Per-resource permissions model and sharing workflows.",
    icon: "Share2",
  },
  organization: {
    description: "Multi-org support, roles, guests, and permissions.",
    icon: "Building2",
  },
  integrations: {
    description: "MCP connection management, OAuth, and connector persistence.",
    icon: "Plug",
  },
  notifications: {
    description: "Notification events, delivery channels, and scheduling.",
    icon: "Bell",
  },
  platform: {
    description: "Brand guide, mobile app, tool result cards, and auto-registry.",
    icon: "Monitor",
  },
  registries: {
    description: "Tool catalog, database schema reference, and API documentation.",
    icon: "Database",
  },
  archive: {
    description: "Superseded documents kept for historical reference.",
    icon: "Archive",
  },
};

function slugFromPath(filePath: string): string {
  const relative = path.relative(DOCS_ROOT, filePath);
  return relative
    .replace(/\.md$/, "")
    .replace(/README$/, "")
    .replace(/\/$/, "");
}

function countDocs(node: DocNode): number {
  if (!node.isDirectory) return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countDocs(child), 0);
}

function buildTree(dirPath: string): DocNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: DocNode[] = [];

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
        const dirNode: DocNode = {
          name: formatDirName(entry.name),
          slug: slugFromPath(fullPath),
          path: fullPath,
          isDirectory: true,
          children,
        };
        dirNode.docCount = countDocs(dirNode);
        nodes.push(dirNode);
      }
    } else if (entry.name.endsWith(".md")) {
      nodes.push({
        name: formatDirName(entry.name),
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

export function getDocContent(slug: string): { title: string; content: string; lastModified: string } | null {
  const targetPath = slug
    ? path.join(DOCS_ROOT, slug + ".md")
    : path.join(DOCS_ROOT, "README.md");

  if (fs.existsSync(targetPath)) {
    const content = fs.readFileSync(targetPath, "utf-8");
    const title = extractTitle(content, slug);
    const stats = fs.statSync(targetPath);
    const lastModified = stats.mtime.toISOString();
    return { title, content, lastModified };
  }

  const indexPath = path.join(DOCS_ROOT, slug, "README.md");
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, "utf-8");
    const title = extractTitle(content, slug);
    const stats = fs.statSync(indexPath);
    const lastModified = stats.mtime.toISOString();
    return { title, content, lastModified };
  }

  return null;
}

function extractTitle(content: string, fallbackSlug: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  const parts = fallbackSlug.split("/");
  return formatDirName(parts[parts.length - 1] || "Documentation");
}

export function extractHeadings(content: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ level, text, id });
    }
  }

  return headings;
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

/** Flatten the tree into an ordered list for prev/next navigation */
function flattenTree(nodes: DocNode[]): FlatDoc[] {
  const flat: FlatDoc[] = [];

  function walk(nodes: DocNode[], category: string) {
    for (const node of nodes) {
      if (node.isDirectory) {
        walk(node.children ?? [], node.name);
      } else {
        const doc = getDocContent(node.slug);
        flat.push({
          title: doc?.title ?? node.name,
          slug: node.slug,
          category,
        });
      }
    }
  }

  walk(nodes, "");
  return flat;
}

export function getFlatDocs(): FlatDoc[] {
  const tree = getDocTree();
  return flattenTree(tree);
}

export function getPrevNextDocs(currentSlug: string): { prev: FlatDoc | null; next: FlatDoc | null } {
  const flat = getFlatDocs();
  const index = flat.findIndex((d) => d.slug === currentSlug);

  if (index === -1) return { prev: null, next: null };

  return {
    prev: index > 0 ? flat[index - 1] : null,
    next: index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export function getDocCategories(): DocCategory[] {
  const tree = getDocTree();
  const categories: DocCategory[] = [];

  for (const node of tree) {
    if (node.isDirectory) {
      const dirName = node.slug;
      const meta = CATEGORY_META[dirName] ?? {
        description: `Documentation for ${node.name}.`,
        icon: "FileText",
      };

      const firstDoc = findFirstDoc(node);

      categories.push({
        name: node.name,
        slug: node.slug,
        description: meta.description,
        docCount: node.docCount ?? 0,
        icon: meta.icon,
        firstDocSlug: firstDoc ?? node.slug,
      });
    }
  }

  return categories;
}

function findFirstDoc(node: DocNode): string | null {
  if (!node.isDirectory) return node.slug;
  for (const child of node.children ?? []) {
    const slug = findFirstDoc(child);
    if (slug) return slug;
  }
  return null;
}

export function getTotalDocCount(): number {
  const tree = getDocTree();
  function count(nodes: DocNode[]): number {
    return nodes.reduce((sum, node) => {
      if (node.isDirectory) return sum + count(node.children ?? []);
      return sum + 1;
    }, 0);
  }
  return count(tree);
}
