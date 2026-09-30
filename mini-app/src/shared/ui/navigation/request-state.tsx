"use client";
import { GnomeProgress } from "@/shared/ui/gnome-progress";
export function RequestState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  if (!loading && !error) return null;
  return <div className="request-state" role={error ? "alert" : "status"} aria-busy={loading}>
    {loading && <GnomeProgress />}
    <p>{loading ? "Загружаем данные…" : error}</p>
    {error && <button type="button" onClick={reload}>Повторить</button>}
  </div>;
}
