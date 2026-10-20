import { useState } from "react";
import { Icon } from "@/shared/ui/icon";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { issueStatusLabels, issueCategories, type IssueFilters as Filters } from "@/entities/issue";
import { commonZones, useHouseSelection } from "@/entities/house";
import { useOnboarding } from "@/features/onboarding/onboarding";
import styles from "./issues-page.module.css";

export function IssueFilters({ filters, categories, onChange, onReset, onRefresh, refreshing = false }: {
  filters: Filters;
  categories: readonly string[];
  onChange: (filters: Filters) => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const { activeTarget } = useOnboarding();
  const { house } = useHouseSelection();
  const statusOptions = { all: "Все статусы", active: "Активные", ...issueStatusLabels };
  const count = [filters.category, filters.entrance, filters.floor, filters.zone, filters.onlyMine].filter(Boolean).length;
  const [expanded,setExpanded]=useState(false);
  const open=expanded || activeTarget === "issue-controls";
  const upstairs = Number(filters.floor) > 1;
  return <div>
    <div className={styles.searchRow}><label className={styles.search} data-tour="issue-search"><Icon name="search" /><input type="search" aria-label="Найти обращение" placeholder="Найти обращение" value={filters.query} onChange={event => onChange({...filters,query:event.target.value})} /></label><button className={styles.filterTrigger} type="button" aria-expanded={open} aria-controls="issue-filter-panel" onClick={() => setExpanded(value => !value)}><Icon name="settings" size={20} /><span>Фильтры{count>0 ? ` · ${count}` : ""}</span></button></div>
    {open &&     <section id="issue-filter-panel" aria-label="Фильтры обращений" className={styles.filters} data-motion-panel>
    <label>Статус<select value={filters.status} onChange={event => onChange({ ...filters, status: event.target.value as Filters["status"] })}>
      {Object.entries(statusOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Категория<select value={filters.category} onChange={event => onChange({ ...filters, category: event.target.value })}>
      <option value="">Все категории</option>
      {[...new Set([...issueCategories, ...categories])].map(category => <option key={category}>{category}</option>)}
    </select></label>
    <label>Подъезд<select value={filters.entrance} onChange={event => onChange({ ...filters, entrance: event.target.value })}>
      <option value="">Все подъезды</option>
      {Array.from({ length: house.entrances }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
    </select></label>
    <label>Этаж<select value={filters.floor} onChange={event => {
      const floor = event.target.value;
      const upperFloor = Number(floor) > 1;
      onChange({ ...filters, floor, zone: upperFloor && ["entrance", "courtyard", "parking", "house"].includes(filters.zone) ? "" : filters.zone });
    }}>
      <option value="">Все этажи</option>
      {Array.from({ length: house.floors }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
    </select></label>
    <label>Помещение<select value={filters.zone} onChange={event => onChange({ ...filters, zone: event.target.value })}>
      <option value="">Все помещения</option>
      {Object.entries(commonZones).filter(([value]) => !upstairs || !["entrance", "courtyard", "parking", "house"].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      <option value="apartment">Квартира</option>
    </select></label>
    <label>Автор<select value={filters.onlyMine ? "mine" : "all"} onChange={event => onChange({ ...filters, onlyMine: event.target.value === "mine" })}><option value="all">Все обращения</option><option value="mine">Мои обращения</option></select></label>
    <div className={styles.filterActions}><button type="button" onClick={onReset}>Сбросить фильтры</button><RefreshButton onRefresh={onRefresh} loading={refreshing}>Обновить обращения</RefreshButton></div>
  </section>}</div>;
}
