"use client";
import { useState } from "react";
import { IssueList, useIssues, filterIssues, initialIssueFilters } from "@/entities/issue";
import { ReportIssueLink } from "@/features/report-issue";
import { NavigationLinks } from "@/shared/ui/navigation";
import { IssueFilters } from "./issue-filters";
import styles from "./issues-page.module.css";
export function IssuesPage({ initialCategory = "" }: { initialCategory?: string }) {
  const { issues } = useIssues();
  const [filters, setFilters] = useState({ ...initialIssueFilters, category: initialCategory });
  const visible = filterIssues(issues, filters);
  return <><header className={styles.heading}><div><h1>Обращения</h1><p>Всё, что происходит в вашем доме · ул. Центральная, 18</p></div><ReportIssueLink /></header>
    <nav className={styles.tabs} aria-label="Статус обращений">{([{ value: "active", label: "Активные" }, { value: "completed", label: "Решённые" }, { value: "all", label: "Все" }] as const).map(tab => <button key={tab.value} type="button" aria-pressed={filters.status === tab.value} onClick={() => setFilters({ ...filters, status: tab.value })}>{tab.label}<span>{issues.filter(issue => tab.value === "all" || (tab.value === "active" ? issue.status !== "completed" : issue.status === "completed")).length}</span></button>)}</nav>
    <IssueFilters filters={filters} categories={issues.map(issue => issue.category)} onChange={setFilters} onReset={() => setFilters(initialIssueFilters)} />
    <div className={styles.summary} role="status"><span>Найдено: <b>{visible.length}</b> из {issues.length}</span></div>
    {visible.length ? <IssueList issues={visible} /> : <div className={styles.empty}>
      <h2>{issues.length ? "Обращения не найдены" : "Обращений ещё нет"}</h2>
      <p>{issues.length ? "Измените условия поиска или сбросьте фильтры." : "Сообщите о проблеме с помощью кнопки выше."}</p>
      {issues.length > 0 && <button type="button" className={styles.emptyButton} onClick={() => setFilters(initialIssueFilters)}>Сбросить фильтры</button>}
    </div>}
    <NavigationLinks label="Места обращений" items={[{ href: "/plan", title: "Посмотреть обращения на плане" }]} />
  </>;
}
