"use client";
import { useState } from "react";
import { IssueList, useIssues, filterIssues, initialIssueFilters } from "@/entities/issue";
import { ReportIssueLink } from "@/features/report-issue";
import { NavigationLinks } from "@/shared/ui/navigation";
import { IssueFilters } from "./issue-filters";
import styles from "./issues-page.module.css";
export function IssuesPage() {
  const { issues } = useIssues();
  const [filters, setFilters] = useState(initialIssueFilters);
  const visible = filterIssues(issues, filters);
  return <><header className={styles.heading}><div><h1>Мои обращения</h1><p>ул. Центральная, 18</p></div><ReportIssueLink /></header>
    <IssueFilters filters={filters} categories={issues.map(issue => issue.category)} onChange={setFilters} onReset={() => setFilters(initialIssueFilters)} />
    <div className={styles.summary} role="status"><span>Найдено: <b>{visible.length}</b> из {issues.length}</span></div>
    {visible.length ? <IssueList issues={visible} /> : <div className={styles.empty}>
      <h2>{issues.length ? "Обращения не найдены" : "Обращений ещё нет"}</h2>
      <p>{issues.length ? "Измените условия поиска или сбросьте фильтры." : "Сообщите о проблеме с помощью кнопки выше."}</p>
    </div>}
    <NavigationLinks label="Места обращений" items={[{ href: "/plan", title: "Посмотреть обращения на плане" }]} />
  </>;
}
