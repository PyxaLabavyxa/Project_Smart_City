"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { parseProfile, type ResidentProfile } from "./api";

/** Refresh membership without unmounting forms or replacing identical house data. */
export function useResidentProfile() {
  const api = useApi();
  const [state, setState] = useState<{ data?: ResidentProfile; error: string }>({ error: "" });
  const pending = useRef<{ controller: AbortController; task: Promise<ResidentProfile> } | null>(null);
  const refresh = useCallback(() => {
    if (pending.current && !pending.current.controller.signal.aborted) return pending.current.task;
    const controller = new AbortController();
    const task = api(endpoints.me, { signal: controller.signal }).then(value => {
      const data = parseProfile(value);
      if (!controller.signal.aborted) setState(previous =>
        JSON.stringify(previous.data) === JSON.stringify(data) && !previous.error ? previous : { data, error: "" });
      return data;
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : "Не удалось обновить квартиры" }));
      throw error;
    }).finally(() => { if (pending.current?.controller === controller) pending.current = null; });
    pending.current = { controller, task };
    return task;
  }, [api]);
  useEffect(() => {
    const wake = () => { if (!document.hidden) void refresh().catch(() => {}); };
    wake();
    const timer = window.setInterval(wake, 20000);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(timer); pending.current?.controller.abort();
      window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake);
    };
  }, [refresh]);
  return { ...state, refresh };
}
