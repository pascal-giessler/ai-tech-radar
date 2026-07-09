"use client";

/** Eye / eye-off toggle for a single cluster's visibility. */
export function EyeToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={hidden ? "Show cluster" : "Hide cluster"}
      aria-label={hidden ? "Show cluster" : "Hide cluster"}
      aria-pressed={hidden}
      className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border transition-colors"
      style={{
        borderColor: hidden ? "rgba(116,224,255,0.14)" : "rgba(116,224,255,0.22)",
        color: hidden ? "#4d6f86" : "#93b4c9",
        background: hidden ? "transparent" : "rgba(116,224,255,0.06)",
      }}
    >
      {hidden ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}
