"use client";
export function RequestState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  if (!loading && !error) return null;
  return <div className="request-state" role={error ? "alert" : "status"} aria-busy={loading}>
    <p>{loading ? "Загружаем данные…" : error}</p>
    {error && <button type="button" onClick={reload}>Повторить</button>}
  </div>;
}
