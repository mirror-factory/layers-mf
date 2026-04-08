import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocTree, getDocContent, getAllDocSlugs, extractHeadings, getPrevNextDocs } from "@/lib/docs";
import { DocsPage } from "@/components/docs-page";

type Props = {
  params: Promise<{ slug: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug.join("/");
  const doc = getDocContent(slugPath);

  return {
    title: doc ? `${doc.title} -- Docs -- Layers` : "Documentation -- Layers",
    description: doc ? `Architecture documentation: ${doc.title}` : "Architecture documentation for Layers.",
    alternates: {
      types: {
        "text/markdown": "/llms.txt",
      },
    },
  };
}

export function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs
    .filter((s) => s !== "")
    .map((s) => ({ slug: s.split("/") }));
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const slugPath = slug.join("/");
  const tree = getDocTree();
  const doc = getDocContent(slugPath);

  if (!doc) notFound();

  const headings = extractHeadings(doc.content);
  const { prev, next } = getPrevNextDocs(slugPath);

  return (
    <DocsPage
      tree={tree}
      title={doc.title}
      content={doc.content}
      slug={slugPath}
      headings={headings}
      lastModified={doc.lastModified}
      prev={prev}
      next={next}
    />
  );
}
