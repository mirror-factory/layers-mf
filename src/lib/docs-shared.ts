/** Shared types and utilities for docs — safe to import from client components */

export type DocNode = {
  name: string;
  slug: string;
  path: string;
  isDirectory: boolean;
  children?: DocNode[];
  docCount?: number;
};

export type DocHeading = {
  level: number;
  text: string;
  id: string;
};

export type DocCategory = {
  name: string;
  slug: string;
  description: string;
  docCount: number;
  icon: string;
  firstDocSlug: string;
};

export type FlatDoc = {
  title: string;
  slug: string;
  category: string;
};

export function formatDirName(name: string): string {
  return name
    .replace(/\.md$/, "")
    .replace(/README/, "Overview")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
