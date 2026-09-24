"use client";
import Link from "next/link";
import { IssueList, useIssues } from "@/entities/issue";
import { ReportIssueLink } from "@/features/report-issue";
import styles from "./home-page.module.css";
export function HomePage() {
  const { issues } = useIssues();
  const active = issues.filter(issue => issue.status !== "completed").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);
  return <><header className={styles.heading}><div><h1>ул. Центральная, 18</h1><p>Мой дом</p></div><ReportIssueLink /></header>
    <section aria-labelledby="active-issues"><div className={styles.sectionHead}><h2 id="active-issues">Активные обращения</h2><Link href="/issues">Все <span aria-hidden="true">→</span></Link></div>
      {active.length ? <IssueList issues={active} /> : <p className={styles.empty}>Активных обращений пока нет.</p>}
    </section></>;
}
