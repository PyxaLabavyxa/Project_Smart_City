import Link from "next/link";
import styles from "./issue-details.module.css";

export function IssueNotFoundPage() {
  return <>
    <h1>Обращение не найдено</h1>
    <p>В списке нет обращения с таким номером.</p>
    <Link href="/issues" className={styles.back}>Вернуться к обращениям</Link>
  </>;
}
