import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Layers — AI Context Platform",
    template: "%s | Layers",
  },
  description:
    "The operating system for AI-native teams. Connect every tool into a single context layer with intelligent agents.",
  keywords: [
    "AI",
    "context",
    "knowledge management",
    "team collaboration",
    "RAG",
  ],
  authors: [{ name: "Mirror Factory" }],
  openGraph: {
    title: "Layers — AI Context Platform",
    description:
      "Connect every tool into a single context layer with intelligent agents.",
    siteName: "Layers",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
