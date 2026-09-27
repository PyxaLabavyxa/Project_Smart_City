import styles from "@/shared/ui/navigation/page-state.module.css";

export default function Loading() {
  return <div className={styles.loading} role="status" aria-live="polite" aria-busy="true">
    <p>Загружаем раздел…</p>
    <div className={styles.skeleton} aria-hidden="true"><span /><span /><div /><div /></div>
  </div>;
}
