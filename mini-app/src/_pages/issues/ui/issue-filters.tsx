import { useState } from "react";
import { Icon } from "@/shared/ui/icon";
import { issueStatusLabels, type IssueFilters as Filters } from "@/entities/issue";
import { availableIssueCategories, availableIssueZones, changeIssueCategoryFilter, changeIssueLocationFilter, issueFilterCategoryLabel } from "@/entities/issue/model/issue-filters";
import { LocationFilters, useHouseSelection } from "@/entities/house";
import { useOnboarding } from "@/features/onboarding/onboarding-context";
import styles from "./issues-page.module.css";

export function IssueFilters({ filters, onChange, onReset }: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  const { activeTarget } = useOnboarding();
  const { house } = useHouseSelection();
  const statusOptions = { all: "Все статусы", ...issueStatusLabels };
  const categories = availableIssueCategories(filters.zone, filters);
  const filteredStatus = filters.status !== "all";
  const count = [filters.category, filters.entrance, filters.zone === "entrance" ? "" : filters.floor, filters.zone, filteredStatus].filter(Boolean).length;
  const [expanded,setExpanded]=useState(false);
  const open=expanded || activeTarget === "issue-controls";
  return <div>
    <div className={styles.searchRow}><label className={styles.search} data-tour="issue-search"><Icon name="search" /><input type="search" aria-label="Найти обращение" placeholder="Найти обращение" value={filters.query} onChange={event => onChange({...filters,query:event.target.value})} /></label><button className={styles.filterTrigger} type="button" aria-expanded={open} aria-controls="issue-filter-panel" onClick={() => setExpanded(value => !value)}><Icon name="settings" size={20} /><span>Фильтры{count>0 ? ` · ${count}` : ""}</span></button></div>
    <section id="issue-filter-panel" data-tour="issue-controls" aria-label="Фильтры обращений" className={styles.filters} data-motion-panel hidden={!open} inert={!open}>
    <LocationFilters house={house} value={filters} zones={availableIssueZones(filters)} onChange={(key, value) => onChange(changeIssueLocationFilter(filters, key, value, house))}>
    <label>Категория<select value={filters.category} title={filters.category ? issueFilterCategoryLabel(filters.category, filters.zone) : "Все категории"} onChange={event => onChange(changeIssueCategoryFilter(filters, event.target.value, house))}>
      <option value="">Все категории</option>
      {categories.map(category => <option key={category} value={category}>{issueFilterCategoryLabel(category, filters.zone)}</option>)}
    </select></label>
    <label>Статус<select value={filters.status} title={statusOptions[filters.status]} onChange={event => onChange({ ...filters, status: event.target.value as Filters["status"] })}>
      {Object.entries(statusOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    </LocationFilters>
    <div className={styles.filterActions}><button type="button" onClick={onReset}>Сбросить фильтры</button></div>
  </section></div>;
}
