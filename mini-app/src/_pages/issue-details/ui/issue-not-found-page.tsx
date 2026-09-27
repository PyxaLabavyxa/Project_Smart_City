import Link from "next/link";
import styles from "@/shared/ui/navigation/page-state.module.css";

export function IssueNotFoundPage() {
  return <section className={styles.state}>
    <h1>Обращение не найдено</h1>
    <p>В списке нет обращения с таким номером.</p>
    <Link href="/issues" className={styles.primary}>Вернуться к обращениям</Link>
  </section>;
}
