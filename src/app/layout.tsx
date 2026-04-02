import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: {
    default: "Granger — Your AI Chief of Staff",
    template: "%s | Granger",
  },
  description:
    "Your AI Chief of Staff. Connect every tool into a single context layer with intelligent agents.",
  keywords: [
    "AI",
    "chief of staff",
    "context",
    "knowledge management",
    "team collaboration",
  ],
  authors: [{ name: "Mirror Factory" }],
  openGraph: {
    title: "Granger — Your AI Chief of Staff",
    description:
      "Your AI Chief of Staff. Connect every tool into a single context layer with intelligent agents.",
    siteName: "Granger",
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
      <head>
        {/* Libraries for inline HTML rendering in chat */}
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js" defer />
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js" defer />
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/MotionPathPlugin.min.js" defer />
        <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js" defer />
        <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" defer />
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js" defer />
        <script src="https://cdn.jsdelivr.net/npm/animejs@3/lib/anime.min.js" defer />
        <script src="https://cdn.jsdelivr.net/npm/lottie-web@5/build/player/lottie.min.js" defer />
      </head>
      <body className={`${inter.className} ${playfair.variable} min-h-screen bg-background font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
