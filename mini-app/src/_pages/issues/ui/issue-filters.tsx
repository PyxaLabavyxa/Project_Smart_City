import { issueStatusLabels, issueCategories, type IssueFilters as Filters } from "@/entities/issue";
import { commonZones, useHouseSelection } from "@/entities/house";
import { useOnboarding } from "@/features/onboarding/onboarding";
import styles from "./issues-page.module.css";

export function IssueFilters({ filters, categories, onChange, onReset }: {
  filters: Filters;
  categories: readonly string[];
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  const { activeTarget } = useOnboarding();
  const { house } = useHouseSelection();
  const statusOptions = { all: "Все статусы", active: "Активные", ...issueStatusLabels };
  const count = [filters.category, filters.entrance, filters.floor, filters.zone, filters.query, filters.onlyMine].filter(Boolean).length;
  return <details className={styles.filterPanel} open={activeTarget === "issue-controls" || count > 0 || undefined}>
    <summary data-tour="issue-search">Фильтры и поиск {count > 0 && <span>· {count}</span>}</summary>
    <section aria-label="Фильтры обращений" className={styles.filters}>
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
    <label>Этаж<select value={filters.floor} onChange={event => onChange({ ...filters, floor: event.target.value })}>
      <option value="">Все этажи</option>
      {Array.from({ length: house.floors }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
    </select></label>
    <label>Помещение<select value={filters.zone} onChange={event => onChange({ ...filters, zone: event.target.value })}>
      <option value="">Все помещения</option>
      {Object.entries(commonZones).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      <option value="apartment">Квартира</option>
    </select></label>
    <label>Поиск<input type="search" value={filters.query} onChange={event => onChange({ ...filters, query: event.target.value })} placeholder="Название или место" /></label>
    <label>Автор<select value={filters.onlyMine ? "mine" : "all"} onChange={event => onChange({ ...filters, onlyMine: event.target.value === "mine" })}><option value="all">Все обращения</option><option value="mine">Мои обращения</option></select></label>
    <button type="button" onClick={onReset}>Сбросить фильтры</button>
  </section></details>;
}
