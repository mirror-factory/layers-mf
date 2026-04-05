'use client';

import { useState } from 'react';
import { FileCode2, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

interface FileTreeProps {
  files: FileNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

/** Convert flat file list into nested tree structure */
export function buildFileTree(files: { path: string; content: string }[]): FileNode[] {
  const root: FileNode[] = [];

  for (const file of files) {
    if (!file.path) continue; // skip files with undefined path
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');

      let existing = current.find(n => n.name === name);
      if (!existing) {
        existing = {
          name,
          path: fullPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          content: isFile ? file.content : undefined,
          language: isFile ? getLanguageFromPath(name) : undefined,
        };
        current.push(existing);
      }
      if (!isFile) current = existing.children!;
    }
  }

  return sortTree(root);
}

/** Sort: folders first, then files, alphabetical within each group */
function sortTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .map(n => n.children ? { ...n, children: sortTree(n.children) } : n)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function getLanguageFromPath(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    html: 'html', css: 'css', json: 'json', py: 'python',
    md: 'markdown', yml: 'yaml', yaml: 'yaml', sh: 'bash',
    svg: 'svg', xml: 'xml', sql: 'sql', rs: 'rust', go: 'go',
    rb: 'ruby', toml: 'toml', env: 'text', txt: 'text',
  };
  return map[ext] ?? 'text';
}

/** Find a file node by path in the tree */
export function findFileNode(nodes: FileNode[], path: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findFileNode(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

export function FileTree({ files, selectedPath, onSelectFile }: FileTreeProps) {
  return (
    <div className="text-xs py-1 select-none">
      {files.map(node => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          depth={0}
        />
      ))}
    </div>
  );
}

function FileTreeNode({ node, selectedPath, onSelectFile, depth }: {
  node: FileNode;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = node.path === selectedPath;

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full px-2 py-0.5 hover:bg-muted/50 text-muted-foreground transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded
            ? <ChevronDown className="h-3 w-3 shrink-0" />
            : <ChevronRight className="h-3 w-3 shrink-0" />
          }
          {expanded
            ? <FolderOpen className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            : <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          }
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <FileTreeNode
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={cn(
        "flex items-center gap-1.5 w-full px-2 py-0.5 hover:bg-muted/50 transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileCode2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
