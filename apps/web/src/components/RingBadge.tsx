import { ringMeta } from "@/lib/rings";
import type { Ring } from "@/lib/types";

export function RingBadge({ ring, size = "sm" }: { ring: Ring | null; size?: "sm" | "md" }) {
  if (!ring) return null;
  const meta = ringMeta(ring);
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-[0.14em] ${pad}`}
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
      title={meta.blurb}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
