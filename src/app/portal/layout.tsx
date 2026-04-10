import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Document Portal — Granger",
  description: "Interactive document viewer with AI-powered chat",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[hsl(168,14%,5%)] dark:text-[hsl(165,15%,95%)]">
      {children}
    </div>
  );
}
