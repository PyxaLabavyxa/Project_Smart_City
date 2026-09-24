"use client";
import { IssueList, useIssues } from "@/entities/issue";
import { ReportIssueLink } from "@/features/report-issue";
import styles from "./issues-page.module.css";
export function IssuesPage() {
  const { issues } = useIssues();
  return <><header className={styles.heading}><div><h1>Мои обращения</h1><p>ул. Центральная, 18</p></div><ReportIssueLink /></header>
    <div className={styles.summary}><span>Всего обращений: <b>{issues.length}</b></span></div>
    <IssueList issues={issues} />
  </>;
}
