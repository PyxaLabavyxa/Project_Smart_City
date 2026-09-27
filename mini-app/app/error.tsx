"use client";

import Link from "next/link";
import styles from "@/shared/ui/navigation/page-state.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className={styles.state} aria-labelledby="page-error">
    <span className={styles.symbol} aria-hidden="true">!</span>
    <h1 id="page-error">Не удалось открыть раздел</h1>
    <p role="alert">Попробуйте ещё раз. Можно перейти в другой раздел и вернуться позже.</p>
    <div className={styles.actions}><button type="button" className={styles.primary} onClick={reset}>Попробовать ещё раз</button><Link className={styles.button} href="/">На главную</Link></div>
  </section>;
}
