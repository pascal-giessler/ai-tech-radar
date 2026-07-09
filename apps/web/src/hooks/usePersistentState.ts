"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State mirrored to localStorage, SSR-safe.
 *
 * The initial render (server and first client paint) always uses `initial` so
 * hydration never mismatches; the stored value is read in an effect right after
 * mount and applied once. A corrupt/absent entry falls back to `initial` and
 * never throws.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* corrupt entry — keep the default */
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or private-mode — degrade to in-memory only */
    }
  }, [key, value]);

  const set = useCallback((next: T | ((prev: T) => T)) => setValue(next), []);
  return [value, set];
}
