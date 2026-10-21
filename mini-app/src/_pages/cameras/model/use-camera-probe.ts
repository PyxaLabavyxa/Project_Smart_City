import { useEffect, useState } from "react";
import type { ApiClient } from "@/shared/api/client";
import { record, string } from "@/shared/api/parse";

export function useCameraProbe(api: ApiClient, path: string, body: string, enabled: boolean) {
  const [attempt, retry] = useState(0);
  const key = `${path}:${body}:${attempt}`;
  const [result, setResult] = useState<{ key: string; sourceType?: string; src?: string; error?: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = record(await api(path, { body: JSON.parse(body), signal: controller.signal }));
        const src = string(data.src);
        const sourceType = string(data.source_type);
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(src)) throw new Error("Не удалось получить снимок камеры");
        if (!controller.signal.aborted) setResult({ key, src, sourceType });
      } catch (failure) {
        if (!controller.signal.aborted) setResult({ key, error: failure instanceof Error ? failure.message : "Камера недоступна. Перепроверьте ссылку." });
      }
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, path, body, enabled, key]);
  const current = result?.key === key ? result : null;
  return { status: !enabled ? "idle" : !current ? "checking" : current.error ? "error" : "success", ...current, retry: () => retry(value => value + 1) };
}
