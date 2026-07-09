"use client";

import { useCallback, useMemo } from "react";

import { usePersistentState } from "./usePersistentState";

const KEY = "airadar.hidden-clusters.v1";

export interface ClusterVisibility {
  /** True when the cluster (by slug) should be shown. */
  isVisible: (slug: string) => boolean;
  hiddenSlugs: Set<string>;
  hiddenCount: number;
  toggle: (slug: string) => void;
  /** Show only this cluster (hide every other slug in `allSlugs`). */
  solo: (slug: string, allSlugs: string[]) => void;
  showAll: () => void;
  hideAll: (allSlugs: string[]) => void;
}

/**
 * View-layer cluster visibility, persisted to localStorage.
 *
 * Keyed by cluster SLUG, never id: the backend reassigns cluster ids on every
 * recompute (it deletes + re-inserts the cluster table), so an id-keyed hidden
 * set would silently point at the wrong cluster after a refresh. Slugs are stable.
 */
export function useClusterVisibility(): ClusterVisibility {
  const [hidden, setHidden] = usePersistentState<string[]>(KEY, []);

  const hiddenSlugs = useMemo(() => new Set(hidden), [hidden]);

  const isVisible = useCallback((slug: string) => !hiddenSlugs.has(slug), [hiddenSlugs]);

  const toggle = useCallback(
    (slug: string) =>
      setHidden((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug])),
    [setHidden],
  );

  const solo = useCallback(
    (slug: string, allSlugs: string[]) => setHidden(allSlugs.filter((s) => s !== slug)),
    [setHidden],
  );

  const showAll = useCallback(() => setHidden([]), [setHidden]);

  const hideAll = useCallback((allSlugs: string[]) => setHidden([...allSlugs]), [setHidden]);

  return { isVisible, hiddenSlugs, hiddenCount: hiddenSlugs.size, toggle, solo, showAll, hideAll };
}
