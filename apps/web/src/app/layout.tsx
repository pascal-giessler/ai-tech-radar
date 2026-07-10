import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

const TITLE = "AI Radar — a living technology radar for any tech domain";
const DESCRIPTION =
  "A live scanning radar for trending GitHub repos: clustered by what they do and ranked by momentum, re-scanned continuously. Ships pointed at AI dev tools — switch the tracked domain from the UI. Explore adoption rings, filter the catalog, and open a full dossier on any tool.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · AI Radar" },
  description: DESCRIPTION,
  applicationName: "AI Radar",
  keywords: [
    "AI tools",
    "technology radar",
    "trending GitHub repos",
    "LLM tools",
    "developer tools",
    "open source AI",
    "adoption ring",
    "AI dev tools radar",
  ],
  authors: [{ name: "AI Radar" }],
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "AI Radar",
    type: "website",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060c16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
