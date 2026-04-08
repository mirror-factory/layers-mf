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
    <div className="dark min-h-screen bg-[hsl(168,14%,5%)] text-[hsl(165,15%,95%)]">
      {children}
    </div>
  );
}
