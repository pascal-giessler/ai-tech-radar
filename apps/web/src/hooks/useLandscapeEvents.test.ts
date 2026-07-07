// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLandscapeEvents } from "./useLandscapeEvents";

type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Listener[]>();
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

describe("useLandscapeEvents", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("subscribes to /api/events and surfaces landscape_updated payloads", () => {
    const onUpdate = vi.fn();
    renderHook(() => useLandscapeEvents(onUpdate));

    const source = MockEventSource.instances[0];
    expect(source.url).toBe("/api/events");

    act(() => source.emit("landscape_updated", { type: "landscape_updated", tool_count: 42 }));
    expect(onUpdate).toHaveBeenCalledWith({ type: "landscape_updated", tool_count: 42 });
  });

  it("closes the stream on unmount", () => {
    const { unmount } = renderHook(() => useLandscapeEvents(vi.fn()));
    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });
});
