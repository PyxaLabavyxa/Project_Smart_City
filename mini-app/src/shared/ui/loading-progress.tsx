import styles from "./loading-progress.module.css";

export function LoadingProgress({ value, label = "Загрузка данных" }: { value?: number; label?: string }) {
  const progress = value === undefined ? undefined : Math.max(0, Math.min(100, value));
  return <div className={styles.track} data-indeterminate={progress === undefined || undefined} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === undefined ? undefined : Math.round(progress)}>
    <span style={{ transform: `scaleX(${(progress ?? 35) / 100})` }} />
  </div>;
}
