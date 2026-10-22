import { useState } from "react";
import { Icon } from "@/shared/ui/icon";
import { issueStatusLabels, issueCategories, type IssueFilters as Filters } from "@/entities/issue";
import { LocationFilters, changeLocationFilter, useHouseSelection } from "@/entities/house";
import { useOnboarding } from "@/features/onboarding/onboarding-context";
import styles from "./issues-page.module.css";

export function IssueFilters({ filters, categories, onChange, onReset }: {
  filters: Filters;
  categories: readonly string[];
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  const { activeTarget } = useOnboarding();
  const { house } = useHouseSelection();
  const statusOptions = { all: "Все статусы", active: "Активные", ...issueStatusLabels, completed: "Решённые" };
  const filteredStatus = filters.status !== "all";
  const count = [filters.category, filters.entrance, filters.floor, filters.zone, filteredStatus].filter(Boolean).length;
  const [expanded,setExpanded]=useState(false);
  const open=expanded || activeTarget === "issue-controls";
  return <div>
    <div className={styles.searchRow}><label className={styles.search} data-tour="issue-search"><Icon name="search" /><input type="search" aria-label="Найти обращение" placeholder="Найти обращение" value={filters.query} onChange={event => onChange({...filters,query:event.target.value})} /></label><button className={styles.filterTrigger} type="button" aria-expanded={open} aria-controls="issue-filter-panel" onClick={() => setExpanded(value => !value)}><Icon name="settings" size={20} /><span>Фильтры{count>0 ? ` · ${count}` : ""}</span></button></div>
    <section id="issue-filter-panel" aria-label="Фильтры обращений" className={styles.filters} data-motion-panel hidden={!open} inert={!open}>
    <label>Статус<select value={filters.status} onChange={event => onChange({ ...filters, status: event.target.value as Filters["status"] })}>
      {Object.entries(statusOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Категория<select value={filters.category} onChange={event => onChange({ ...filters, category: event.target.value })}>
      <option value="">Все категории</option>
      {[...new Set([...issueCategories, ...categories])].map(category => <option key={category}>{category}</option>)}
    </select></label>
    <LocationFilters house={house} value={filters} onChange={(key, value) => onChange(changeLocationFilter(filters, key, value))} />
    <div className={styles.filterActions}><button type="button" onClick={onReset}>Сбросить фильтры</button></div>
  </section></div>;
}
