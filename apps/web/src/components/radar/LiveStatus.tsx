"use client";

export function LiveStatus({
  toolCount,
  generatedAt,
}: {
  toolCount: number;
  generatedAt: string;
}) {
  const stamp = new Date(generatedAt);
  const valid = stamp.getTime() > 0;
  return (
    <div className="absolute bottom-5 left-5 z-30 flex items-center gap-2.5 font-mono text-[11px] tracking-wide text-muted">
      <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-sweep" />
      <span>
        {toolCount} tools on the radar
        {valid && (
          <>
            {" · "}
            <time dateTime={generatedAt}>
              scanned {stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>
          </>
        )}
      </span>
    </div>
  );
}
