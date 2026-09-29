"use client";
import { Icon } from "@/shared/ui/icon";
import { useState } from "react";
import { IssueList, useIssues, filterIssues, initialIssueFilters } from "@/entities/issue";
import { ReportIssueLink } from "@/features/report-issue";
import { NavigationLinks } from "@/shared/ui/navigation";
import { IssueFilters } from "./issue-filters";
import styles from "./issues-page.module.css";
import { useHouseSelection } from "@/entities/house";
import { RequestState } from "@/shared/ui/navigation/request-state";
export function IssuesPage({ initialCategory = "" }: { initialCategory?: string }) {
  const { issues, loading, error, reload } = useIssues();
  const { house } = useHouseSelection();
  const [filters, setFilters] = useState({ ...initialIssueFilters, category: initialCategory });
  const visible = filterIssues(issues, filters);
  if (loading || error) return <RequestState loading={loading} error={error} reload={reload} />;
  return <><header className={styles.heading}><div><h1>Обращения</h1><p>Всё, что происходит в вашем доме · {house.address}</p></div><div className={styles.actions}><ReportIssueLink /></div></header>
    <div data-tour="issue-controls"><div data-tour="issue-status" className={styles.statusRow}><nav className={styles.tabs} aria-label="Статус обращений">{([{ value: "active", label: "Активные" }, { value: "completed", label: "Решённые" }, { value: "all", label: "Все" }] as const).map(tab => <button key={tab.value} type="button" aria-pressed={filters.status === tab.value} onClick={() => setFilters({ ...filters, status: tab.value })}>{tab.label}<span>{issues.filter(issue => tab.value === "all" || (tab.value === "active" ? issue.status !== "completed" : issue.status === "completed")).length}</span></button>)}</nav><button type="button" className={styles.refresh} aria-label="Обновить обращения" title="Обновить обращения" onClick={reload}><Icon name="refresh" size={20} /></button></div>
    <IssueFilters filters={filters} categories={issues.map(issue => issue.category)} onChange={setFilters} onReset={() => setFilters(initialIssueFilters)} /></div>
    <div className={styles.summary} role="status"><span>Найдено: <b>{visible.length}</b> из {issues.length}</span></div>
    {visible.length ? <IssueList issues={visible} wide /> : <div className={styles.empty}>
      <h2>{issues.length ? "Обращения не найдены" : "Обращений ещё нет"}</h2>
      <p>{issues.length ? "Измените условия поиска или сбросьте фильтры." : "Сообщите о проблеме с помощью кнопки выше."}</p>
      {issues.length > 0 && <button type="button" className={styles.emptyButton} onClick={() => setFilters(initialIssueFilters)}>Сбросить фильтры</button>}
    </div>}
    <NavigationLinks label="Места обращений" items={[{ href: "/plan", title: "Посмотреть обращения на плане" }]} />
  </>;
}
