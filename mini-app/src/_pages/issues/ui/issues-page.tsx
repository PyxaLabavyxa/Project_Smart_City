"use client";
import { useSearchParams } from "next/navigation";
import { IssueList, useIssues, filterIssues, initialIssueFilters, selectIssueTab } from "@/entities/issue";
import { issueFiltersFromSearch, issueFiltersSearch, normalizeIssueFilters, type IssueFilters as Filters } from "@/entities/issue/model/issue-filters";
import { useHouseSelection } from "@/entities/house";
import { ReportIssueLink } from "@/features/report-issue";
import { IssueFilters } from "./issue-filters";
import { HomeAddress } from "@/_pages/home/ui/home-address";
import styles from "./issues-page.module.css";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { RefreshButton } from "@/shared/ui/refresh-button";

const tabs = [
  { value: "all", label: "Все" },
  { value: "mine", label: "Мои" },
] as const;

export function IssuesPage() {
  const { issues, loading, error, reload } = useIssues();
  const { house } = useHouseSelection();
  const params = useSearchParams();
  const filters = normalizeIssueFilters(issueFiltersFromSearch(params, house.id), house);
  function setFilters(update: Filters | ((current: Filters) => Filters)) {
    const next = normalizeIssueFilters(typeof update === "function" ? update(filters) : update, house);
    window.history.replaceState(null, "", `/issues?${issueFiltersSearch(next, house.id)}`);
  }
  const visible = filterIssues(issues, filters);
  const mineCount = issues.filter(issue => issue.mine).length;
  const noPersonalIssues = filters.onlyMine && mineCount === 0;
  function resetFilters() {
    setFilters(current => ({ ...initialIssueFilters, onlyMine: current.onlyMine }));
  }
  if ((loading || error) && !issues.length) return <RequestState loading={loading} error={error} reload={reload} page />;
  return <div className={styles.content}><HomeAddress compact /><header className={styles.heading}>
    <h1 data-tour="issues-heading">Обращения</h1>
    <div className={styles.create}><ReportIssueLink /></div>
  </header>
    <div data-tour="issue-overview"><div data-tour="issue-status" className={styles.statusRow}>
      <nav className={styles.tabs} aria-label="Список обращений">{tabs.map(tab => {
        const count = tab.value === "mine" ? mineCount : issues.length;
        const selected = tab.value === "mine" ? !!filters.onlyMine : !filters.onlyMine;
        return <button key={tab.value} type="button" aria-pressed={selected} aria-label={`${tab.label}: ${count}`} onClick={() => setFilters(current => selectIssueTab(current, tab.value))}>
          {tab.label}<span aria-hidden="true">{count}</span>
        </button>;
      })}</nav>
      <RefreshButton className={styles.refresh} onRefresh={reload} loading={loading} iconSize={21} aria-label="Обновить обращения" title="Обновить обращения" />
    </div>

    <IssueFilters filters={filters} onChange={setFilters} onReset={resetFilters} /></div>
    <RequestState loading={false} error={error} reload={reload} />
    <div className={styles.summary} role="status"><span>Найдено: <b>{visible.length}</b> из {issues.length}</span></div>
    {visible.length ? <IssueList issues={visible} wide /> : <div className={styles.empty}>
      <h2>{noPersonalIssues ? "У вас пока нет обращений" : issues.length ? "Обращения не найдены" : "Обращений ещё нет"}</h2>
      <p>{noPersonalIssues ? "Здесь появятся обращения, которые вы создадите в этом доме." : issues.length ? "Измените условия поиска или сбросьте фильтры." : "Расскажите о проблеме — нажмите «Создать обращение»."}</p>
      {issues.length > 0 && !noPersonalIssues && <button type="button" className={styles.emptyButton} onClick={resetFilters}>Сбросить фильтры</button>}
    </div>}
  </div>;
}
