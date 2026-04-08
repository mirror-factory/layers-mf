import type { Metadata } from "next";
import { getDocTree, getDocContent } from "@/lib/docs";
import { DocsPage } from "@/components/docs-page";

export const metadata: Metadata = {
  title: "Documentation -- Layers",
  description: "Architecture documentation for Layers.",
};

export default function Page() {
  const tree = getDocTree();
  const doc = getDocContent("");

  return (
    <DocsPage
      tree={tree}
      title={doc?.title ?? "Documentation"}
      content={doc?.content ?? "# Documentation\n\nSelect a document from the sidebar to get started."}
    />
  );
}
