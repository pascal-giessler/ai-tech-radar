"use client";

import dynamic from "next/dynamic";

import type { LandscapeData } from "@/lib/types";

const AppShell = dynamic(() => import("./AppShell").then((m) => m.AppShell), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh w-full items-center justify-center bg-[#04070d] font-mono text-xs uppercase tracking-[0.3em] text-[#5f8299]">
      calibrating instruments…
    </div>
  ),
});

export function AppShellMount({ initial }: { initial: LandscapeData }) {
  return <AppShell initial={initial} />;
}
