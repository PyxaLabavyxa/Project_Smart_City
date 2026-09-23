import Link from "next/link";
import { demoIssues, formatIssueDate, IssueStatus, IssueCategoryIcon } from "@/entities/issue";
import styles from "./issues-page.module.css";

export function IssuesPage() {
  return (
    <>
      <header className={styles.heading}>
        <div>
        <h1>Мои обращения</h1>
        <p>ул. Центральная, 18</p>
        </div>
        <button type="button" className={styles.reportButton} aria-disabled="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Сообщить о проблеме
        </button>
      </header>
      <div className={styles.summary}>
        <span>Всего обращений: <b>{demoIssues.length}</b></span>
      </div>
      <ul className={styles.list} aria-label="Мои обращения">
        {demoIssues.map(issue => (
          <li key={issue.id}>
            <Link href={`/issues/${issue.id}`} className={styles.issue} aria-labelledby={`issue-${issue.id}`}>
              <span className={styles.categoryIcon}><IssueCategoryIcon category={issue.category} /></span>
              <div className={styles.body}>
                <h2 id={`issue-${issue.id}`}>{issue.title}</h2>
                <p className={styles.location}>{issue.location}</p>
                <div className={styles.state}>
                  <IssueStatus status={issue.status} />
                  <time dateTime={issue.createdAt}>{formatIssueDate(issue.createdAt)}</time>
                </div>
              </div>
              <svg className={styles.chevron} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
