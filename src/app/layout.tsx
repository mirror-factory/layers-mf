import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/splash-screen";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

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
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d1512" },
    { media: "(prefers-color-scheme: light)", color: "#34d399" },
  ],
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
        {/* Libraries for inline visual rendering in chat — loaded once, available to all sandboxed iframes */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Granger" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={`${inter.className} ${spaceGrotesk.variable} h-[100dvh] bg-background font-sans antialiased overflow-hidden`}>
        <ThemeProvider>
          <SplashScreen>
            {children}
          </SplashScreen>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
