"use client";

import { useState } from "react";

/**
 * A small "?" affordance that reveals an explanation on hover/focus. Used to make
 * computed signals (momentum score, adoption ring) self-explanatory in place.
 */
export function InfoTip({ text, label = "What is this?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-[14px] w-[14px] items-center justify-center rounded-full border border-[rgba(116,224,255,0.3)] font-mono text-[9px] leading-none text-[#74e0ff] transition-colors hover:border-[#74e0ff] hover:bg-[rgba(116,224,255,0.1)]"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-[calc(100%+7px)] left-1/2 z-50 w-[240px] -translate-x-1/2 rounded-lg border border-[rgba(116,224,255,0.22)] bg-[rgba(9,17,28,0.97)] px-3 py-2 text-left text-[11px] font-normal normal-case leading-[1.5] tracking-normal text-[#bcd6e6] shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-[16px]"
        >
          {text}
        </span>
      )}
    </span>
  );
}
