"use client";
import { LoadingProgress } from "@/shared/ui/loading-progress";
import { RefreshButton } from "@/shared/ui/refresh-button";
export function RequestState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  if (!loading && !error) return null;
  return <div className="request-state" role={error ? "alert" : "status"} aria-busy={loading}>
    {loading && <LoadingProgress />}
    <p>{loading ? "Загружаем данные…" : error}</p>
    {error && <RefreshButton onRefresh={reload} loading={loading}>Повторить</RefreshButton>}
  </div>;
}
