"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Tool } from "@/lib/types";

export function SearchOverlay({
  tools,
  onSelect,
}: {
  tools: Tool[];
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tools
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.owner.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [tools, query]);

  const pick = (slug: string) => {
    onSelect(slug);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="absolute top-16 left-1/2 z-30 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) pick(matches[0].slug);
        }}
        placeholder="search the sky — press /"
        aria-label="Search tools"
        className="w-full rounded-full border border-hairline bg-dome/80 px-4 py-2 font-mono text-sm text-starlight placeholder:text-muted/70 backdrop-blur focus:border-phosphor-dim"
      />
      {open && matches.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded border border-hairline bg-dome/95 backdrop-blur">
          {matches.map((tool) => (
            <li key={tool.slug}>
              <button
                onClick={() => pick(tool.slug)}
                className="flex w-full items-baseline justify-between px-4 py-2 text-left text-sm text-starlight hover:bg-dome-raised"
              >
                <span>
                  {tool.owner}/{tool.name}
                </span>
                <span className="font-mono text-xs text-muted">
                  {Math.round(tool.trend_score)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
