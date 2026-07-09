import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useClusterVisibility } from "./useClusterVisibility";

const ALL = ["agents", "rag", "vector"];

beforeEach(() => window.localStorage.clear());

describe("useClusterVisibility", () => {
  it("shows everything by default", () => {
    const { result } = renderHook(() => useClusterVisibility());
    expect(result.current.isVisible("agents")).toBe(true);
    expect(result.current.hiddenCount).toBe(0);
  });

  it("toggles a single cluster by slug", () => {
    const { result } = renderHook(() => useClusterVisibility());
    act(() => result.current.toggle("rag"));
    expect(result.current.isVisible("rag")).toBe(false);
    expect(result.current.isVisible("agents")).toBe(true);
    act(() => result.current.toggle("rag"));
    expect(result.current.isVisible("rag")).toBe(true);
  });

  it("solo hides every other slug", () => {
    const { result } = renderHook(() => useClusterVisibility());
    act(() => result.current.solo("agents", ALL));
    expect(result.current.isVisible("agents")).toBe(true);
    expect(result.current.isVisible("rag")).toBe(false);
    expect(result.current.isVisible("vector")).toBe(false);
  });

  it("hideAll then showAll", () => {
    const { result } = renderHook(() => useClusterVisibility());
    act(() => result.current.hideAll(ALL));
    expect(result.current.hiddenCount).toBe(3);
    act(() => result.current.showAll());
    expect(result.current.hiddenCount).toBe(0);
  });

  it("persists hidden slugs across remounts", () => {
    const first = renderHook(() => useClusterVisibility());
    act(() => first.result.current.toggle("vector"));
    const second = renderHook(() => useClusterVisibility());
    expect(second.result.current.isVisible("vector")).toBe(false);
  });
});
