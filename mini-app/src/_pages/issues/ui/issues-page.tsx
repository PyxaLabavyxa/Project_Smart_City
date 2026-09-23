import Link from "next/link";
import { demoIssues, formatIssueDate, IssueStatus } from "@/entities/issue";
import styles from "./issues-page.module.css";

export function IssuesPage() {
  return (
    <>
      <header className={styles.heading}>
        <h1>Мои обращения</h1>
        <p>ул. Центральная, 18</p>
      </header>
      <div className={styles.summary}>
        <span>Всего обращений: <b>{demoIssues.length}</b></span>
      </div>
      <ul className={styles.list} aria-label="Мои обращения">
        {demoIssues.map(issue => (
          <li key={issue.id}>
            <Link href={`/issues/${issue.id}`} className={styles.issue} aria-labelledby={`issue-${issue.id}`}>
              <div className={styles.body}>
                <p className={styles.meta}>№ {issue.id} · {issue.category}</p>
                <h2 id={`issue-${issue.id}`}>{issue.title}</h2>
                <p className={styles.location}>{issue.location}</p>
                <p className={styles.description}>{issue.description}</p>
              </div>
              <div className={styles.state}>
                <IssueStatus status={issue.status} />
                <time dateTime={issue.createdAt}>{formatIssueDate(issue.createdAt)}</time>
                <span className={styles.open} aria-hidden="true">Открыть обращение <span>→</span></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
