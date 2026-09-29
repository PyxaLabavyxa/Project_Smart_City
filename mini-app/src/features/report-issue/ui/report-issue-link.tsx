import Link from "next/link";
import styles from "./report-issue.module.css";
export function ReportIssueLink() {
  return <Link data-tour="report-issue" href="/issues/new" className={styles.primary}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Сообщить о проблеме</Link>;
}
