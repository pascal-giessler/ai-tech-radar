import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Space_Grotesk } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AI Radar — a live atlas of the tool sky",
    template: "%s · AI Radar",
  },
  description:
    "AI Radar maps trending GitHub repos and AI dev tools into a live semantic landscape. Tools that solve the same problem cluster together — explore the sky, compare neighbours, pick faster.",
  openGraph: { siteName: "AI Radar", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-baseline justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="pointer-events-auto group flex items-baseline gap-3">
            <span className="font-display text-2xl tracking-wide text-starlight">
              AI&nbsp;Radar
            </span>
            <span className="hidden font-mono text-[11px] tracking-[0.22em] uppercase text-muted sm:inline">
              live atlas of the tool sky
            </span>
          </Link>
          <nav className="pointer-events-auto flex items-center gap-5 font-mono text-[12px] tracking-wide">
            <Link href="/tools" className="text-muted transition-colors hover:text-phosphor">
              catalog
            </Link>
            <a href="/llms.txt" className="text-muted transition-colors hover:text-phosphor">
              llms.txt
            </a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
