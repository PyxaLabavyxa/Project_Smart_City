import Link from "next/link";
import { formatIssueDate, type IssueRecord } from "../model/issue";
import { IssueStatus } from "./issue-status";
import { IssueCategoryIcon } from "./issue-category-icon";
import styles from "./issue-list.module.css";
export function IssueList({ issues, wide = false }: { issues: readonly IssueRecord[]; wide?: boolean }) {
  return (      <ul className={styles.list} aria-label="Обращения" data-wide={wide || undefined}>
        {issues.map(issue => (
          <li key={issue.id}>
            <Link href={`/issues/${issue.id}`} className={styles.issue} aria-label={issue.title}>
              <span className={styles.categoryIcon} data-priority={issue.priority}><IssueCategoryIcon category={issue.category} /></span>
              <div className={styles.body}>
                <h2>{issue.title}</h2>
                <p className={styles.location}>{issue.location}</p>
                <p className={styles.category}>{issue.category}</p>
                <div className={styles.state}>
                  <IssueStatus status={issue.status} />
                  {issue.priority === "high" && <span className={styles.priority}>Высокий приоритет</span>}
                  <time dateTime={issue.createdAt}>{formatIssueDate(issue.createdAt)}</time>
                </div>
              </div>
              <svg className={styles.chevron} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          </li>
        ))}
      </ul>);
}
