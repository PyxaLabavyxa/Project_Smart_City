"use client";
import { LoadingProgress } from "@/shared/ui/loading-progress";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { SectionLoading } from "./section-loading";
export function RequestState({ loading, error, reload, page = false }: { loading: boolean; error: string; reload: () => void; page?: boolean }) {
  if (!loading && !error) return null;
  if (page && loading && !error) return <SectionLoading />;
  return <div className="request-state" role={error ? "alert" : "status"} aria-busy={loading}>
    {loading && <LoadingProgress />}
    <p>{loading ? "Загружаем данные…" : error}</p>
    {error && <RefreshButton onRefresh={reload} loading={loading}>Повторить</RefreshButton>}
  </div>;
}
