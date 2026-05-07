"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Menu,
  X,
  Search,
  ArrowLeft,
  ArrowRight,
  Clock,
  ChevronUp,
  Hash,
} from "lucide-react";
import type { DocNode, DocHeading, FlatDoc } from "@/lib/docs-shared";
import { formatDirName } from "@/lib/docs-shared";

/* ─── Sidebar search helpers ─── */

function filterTree(nodes: DocNode[], query: string): DocNode[] {
  const lower = query.toLowerCase();
  const filtered: DocNode[] = [];

  for (const node of nodes) {
    if (node.isDirectory) {
      const filteredChildren = filterTree(node.children ?? [], query);
      if (filteredChildren.length > 0) {
        filtered.push({ ...node, children: filteredChildren });
      }
    } else {
      if (node.name.toLowerCase().includes(lower)) {
        filtered.push(node);
      }
    }
  }

  return filtered;
}

/* ─── Tree node ─── */

function TreeNode({
  node,
  depth = 0,
  searchActive,
  onNavigate,
}: {
  node: DocNode;
  depth?: number;
  searchActive?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(() => {
    if (searchActive) return true;
    const docPath = node.slug ? `/docs/${node.slug}` : "/docs";
    return pathname.startsWith(docPath);
  });

  // When search becomes active, expand all dirs
  useEffect(() => {
    if (searchActive) setExpanded(true);
  }, [searchActive]);

  // Auto-expand when navigating into this directory
  useEffect(() => {
    const docPath = node.slug ? `/docs/${node.slug}` : "/docs";
    if (pathname.startsWith(docPath) && node.isDirectory) {
      setExpanded(true);
    }
  }, [pathname, node.slug, node.isDirectory]);

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
            "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          )}
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate font-medium">{node.name}</span>
          {node.docCount != null && (
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/50">
              {node.docCount}
            </span>
          )}
        </button>
        {expanded && node.children && (
          <div className="relative">
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-border/50"
              style={{ marginLeft: `${depth * 16 + 18}px` }}
            />
            {node.children.map((child) => (
              <TreeNode
                key={child.slug || child.name}
                node={child}
                depth={depth + 1}
                searchActive={searchActive}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const href = node.slug ? `/docs/${node.slug}` : "/docs";
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="truncate">{node.name}</span>
    </Link>
  );
}

/* ─── Table of contents ─── */

function TableOfContents({ headings }: { headings: DocHeading[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px", threshold: 0 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
        On this page
      </p>
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={cn(
            "block text-[13px] leading-relaxed transition-colors py-0.5",
            heading.level === 3 && "pl-3",
            heading.level === 4 && "pl-6",
            activeId === heading.id
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}

/* ─── Breadcrumb ─── */

function DocBreadcrumb({ slug }: { slug: string }) {
  if (!slug) return null;

  const parts = slug.split("/");

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/docs" className="text-muted-foreground hover:text-foreground">
              Docs
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {parts.map((part, i) => {
          const isLast = i === parts.length - 1;
          const href = `/docs/${parts.slice(0, i + 1).join("/")}`;
          return (
            <span key={part} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{formatDirName(part)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href} className="text-muted-foreground hover:text-foreground">
                      {formatDirName(part)}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/* ─── Prev/Next navigation ─── */

function PrevNextNav({
  prev,
  next,
}: {
  prev: FlatDoc | null;
  next: FlatDoc | null;
}) {
  if (!prev && !next) return null;

  return (
    <div className="mt-12 grid grid-cols-1 gap-4 border-t pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="h-3 w-3" />
            Previous
          </span>
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {prev.title}
          </span>
          {prev.category && (
            <span className="text-xs text-muted-foreground/60">{prev.category}</span>
          )}
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex flex-col items-end gap-1 rounded-xl border bg-card p-4 text-right transition-colors hover:border-primary/30 hover:bg-accent/50"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Next
            <ArrowRight className="h-3 w-3" />
          </span>
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {next.title}
          </span>
          {next.category && (
            <span className="text-xs text-muted-foreground/60">{next.category}</span>
          )}
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

/* ─── Markdown with heading anchors ─── */

function MarkdownContent({ content }: { content: string }) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2 prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:rounded-xl prose-pre:text-[13px] prose-table:text-sm prose-th:text-left prose-th:font-semibold prose-th:border-b-2 prose-td:border-b prose-img:rounded-xl prose-blockquote:border-l-primary/40 prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:not-italic prose-hr:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children, ...props }) => {
            const text = extractText(children);
            const id = slugify(text);
            return (
              <h2 id={id} {...props}>
                <a href={`#${id}`} className="group no-underline hover:no-underline">
                  {children}
                  <Hash className="ml-2 inline h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                </a>
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const text = extractText(children);
            const id = slugify(text);
            return (
              <h3 id={id} {...props}>
                <a href={`#${id}`} className="group no-underline hover:no-underline">
                  {children}
                  <Hash className="ml-1.5 inline h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                </a>
              </h3>
            );
          },
          h4: ({ children, ...props }) => {
            const text = extractText(children);
            const id = slugify(text);
            return (
              <h4 id={id} {...props}>
                <a href={`#${id}`} className="group no-underline hover:no-underline">
                  {children}
                  <Hash className="ml-1.5 inline h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                </a>
              </h4>
            );
          },
          pre: ({ children, ...props }) => (
            <pre className="overflow-x-auto" {...props}>
              {children}
            </pre>
          ),
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto rounded-xl border">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/* ─── Scroll to top button ─── */

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const contentArea = document.getElementById("docs-content-area");
      if (contentArea) {
        setVisible(contentArea.scrollTop > 400);
      }
    };

    const contentArea = document.getElementById("docs-content-area");
    contentArea?.addEventListener("scroll", handleScroll, { passive: true });
    return () => contentArea?.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => {
        const contentArea = document.getElementById("docs-content-area");
        contentArea?.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="fixed bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-accent hover:text-foreground md:bottom-6 md:right-6"
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-4 w-4" />
    </button>
  );
}

/* ─── Main DocsPage ─── */

export function DocsPage({
  tree,
  title,
  content,
  slug = "",
  headings = [],
  lastModified,
  prev = null,
  next = null,
}: {
  tree: DocNode[];
  title: string;
  content: string;
  slug?: string;
  headings?: DocHeading[];
  lastModified?: string;
  prev?: FlatDoc | null;
  next?: FlatDoc | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    return filterTree(tree, searchQuery.trim());
  }, [tree, searchQuery]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Keyboard shortcut: Cmd+K or / to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isIndex = !slug;

  return (
    <div className="flex h-full">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        aria-label="Open doc navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 shrink-0 border-r bg-card/95 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0 md:z-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Link href="/docs" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold">Docs</h2>
          </Link>
          <button
            onClick={closeSidebar}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              ref={searchInputRef}
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-[13px] bg-muted/50 border-0 focus-visible:ring-1"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground/60">
                <span className="text-xs">&#8984;</span>K
              </kbd>
            )}
          </div>
        </div>

        {/* Tree */}
        <ScrollArea className="flex-1">
          <nav className="space-y-0.5 p-2">
            {filteredTree.length > 0 ? (
              filteredTree.map((node) => (
                <TreeNode
                  key={node.slug || node.name}
                  node={node}
                  searchActive={!!searchQuery.trim()}
                  onNavigate={closeSidebar}
                />
              ))
            ) : (
              <div className="px-3 py-8 text-center">
                <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No docs match &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </nav>
        </ScrollArea>
      </aside>

      {/* Content area */}
      <div id="docs-content-area" className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <div className="flex gap-10">
            {/* Main content */}
            <div className="min-w-0 flex-1 max-w-3xl">
              <DocBreadcrumb slug={slug} />

              <h1 className="text-2xl font-bold tracking-tight mb-1 md:text-3xl">{title}</h1>

              {lastModified && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 mb-8">
                  <Clock className="h-3 w-3" />
                  Last updated {new Date(lastModified).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}

              <MarkdownContent content={content} />

              {!isIndex && <PrevNextNav prev={prev} next={next} />}
            </div>

            {/* Table of contents (desktop only) */}
            {headings.length > 0 && (
              <div className="hidden xl:block w-56 shrink-0">
                <div className="sticky top-8">
                  <TableOfContents headings={headings} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ScrollToTop />
    </div>
  );
}
