import Link from "next/link";
import styles from "@/shared/ui/navigation/page-state.module.css";

export function NotFoundPage() {
  return (
    <section className={styles.state}>
      <span className={styles.symbol} aria-hidden="true">?</span>
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или вернитесь на главную.</p>
      <Link className={styles.primary} href="/">Вернуться на главную</Link>
    </section>
  );
}
