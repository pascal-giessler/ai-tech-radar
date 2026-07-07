"use client";

import { useEffect, useRef } from "react";

export interface LandscapeEvent {
  type: "landscape_updated";
  tool_count: number;
}

/** Subscribes to the radar's SSE stream; calls back on every landscape update. */
export function useLandscapeEvents(onUpdate: (event: LandscapeEvent) => void): void {
  const callback = useRef(onUpdate);
  callback.current = onUpdate;

  useEffect(() => {
    const source = new EventSource("/api/events");
    const handle = (event: MessageEvent) => {
      try {
        callback.current(JSON.parse(event.data) as LandscapeEvent);
      } catch {
        // malformed event — ignore, next update will supersede it
      }
    };
    source.addEventListener("landscape_updated", handle);
    return () => source.close();
  }, []);
}
