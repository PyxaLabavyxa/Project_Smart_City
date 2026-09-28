"use client";
import { useEffect, useState } from "react";

export function useRemote<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ data?: T; loading: boolean; error: string }>({ loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: "" });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Не удалось загрузить данные" }));
    });
    return () => controller.abort();
  }, [load, attempt]);
  return { ...state, reload: () => { setState(previous => ({ ...previous, loading: true, error: "" })); setAttempt(value => value + 1); } };
}
