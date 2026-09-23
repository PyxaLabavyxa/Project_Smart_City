import Link from "next/link";
import { formatIssueDate, IssueStatus, type DemoIssue } from "@/entities/issue";
import { IssueHistory } from "./issue-history";
import styles from "./issue-details.module.css";

export function IssueDetailsPage({ issue }: { issue: DemoIssue }) {
  return (
    <>
      <Link href="/issues" className={styles.back}><span aria-hidden="true">←</span> Все обращения</Link>
      <header className={styles.heading}>
        <p className={styles.meta}>Обращение № {issue.id}</p>
        <h1>{issue.title}</h1>
        <div className={styles.status}><IssueStatus status={issue.status} /></div>
      </header>
      <div className={styles.layout}>
        <section className={styles.info} aria-labelledby="issue-information">
          <h2 id="issue-information">Об обращении</h2>
          <dl className={styles.facts}>
            <div><dt>Адрес</dt><dd>{issue.address}</dd></div>
            <div><dt>Место проблемы</dt><dd>{issue.location}</dd></div>
            <div><dt>Категория</dt><dd>{issue.category}</dd></div>
            <div><dt>Дата создания</dt><dd><time dateTime={issue.createdAt}>{formatIssueDate(issue.createdAt)}</time></dd></div>
          </dl>
          <div className={styles.description}>
            <h2>Описание проблемы</h2>
            <p>{issue.description}</p>
          </div>
        </section>
        <IssueHistory issue={issue} />
      </div>
    </>
  );
}
