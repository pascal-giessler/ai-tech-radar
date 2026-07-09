"use client";

import { useCallback, useEffect, useState } from "react";

import type { PresetOption, RadarSettings, RadarSettingsPatch } from "@/lib/types";

/** Browser-side settings client. Hits the proxied `/api/settings` route. */
async function fetchSettings(): Promise<RadarSettings> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  if (!res.ok) throw new Error(`settings responded ${res.status}`);
  return (await res.json()) as RadarSettings;
}

async function patchSettings(patch: RadarSettingsPatch): Promise<RadarSettings> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new Error(detail || `settings PATCH responded ${res.status}`);
  }
  return (await res.json()) as RadarSettings;
}

async function postArea(title: string, topics: string[]): Promise<PresetOption> {
  const res = await fetch("/api/areas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, topics }),
  });
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new Error(detail || `create area responded ${res.status}`);
  }
  return (await res.json()) as PresetOption;
}

/** FastAPI puts validation messages under `detail`; fall back to raw text. */
async function errorDetail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.detail === "string") return parsed.detail;
  } catch {
    /* not JSON */
  }
  return body;
}

export interface SettingsController {
  settings: RadarSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Persist a change; resolves once the backend has accepted it. */
  save: (patch: RadarSettingsPatch) => Promise<void>;
  /** Create a custom area (title + GitHub topics); returns the new preset. */
  createArea: (title: string, topics: string[]) => Promise<PresetOption>;
  reload: () => void;
}

/** Loads radar settings once; `reload()` re-pulls (e.g. after an SSE recompute). */
export function useSettings(): SettingsController {
  const [settings, setSettings] = useState<RadarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const save = useCallback(async (patch: RadarSettingsPatch) => {
    setSaving(true);
    setError(null);
    try {
      setSettings(await patchSettings(patch));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "failed to save settings");
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const createArea = useCallback(async (title: string, topics: string[]) => {
    setSaving(true);
    setError(null);
    try {
      const created = await postArea(title, topics);
      setSettings(await fetchSettings()); // pull the refreshed preset list
      return created;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "failed to create area");
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, error, save, createArea, reload };
}
