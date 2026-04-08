import type { Metadata } from "next";
import { getDocTree, getDocContent, getDocCategories, getTotalDocCount } from "@/lib/docs";
import { DocsIndexPage } from "@/components/docs-index-page";

export const metadata: Metadata = {
  title: "Documentation -- Layers",
  description: "Architecture documentation for Layers.",
};

export default function Page() {
  const tree = getDocTree();
  const doc = getDocContent("");
  const categories = getDocCategories();
  const totalDocs = getTotalDocCount();

  return (
    <DocsIndexPage
      tree={tree}
      categories={categories}
      totalDocs={totalDocs}
      overviewContent={doc?.content}
      overviewTitle={doc?.title ?? "Documentation"}
      lastModified={doc?.lastModified}
    />
  );
}
