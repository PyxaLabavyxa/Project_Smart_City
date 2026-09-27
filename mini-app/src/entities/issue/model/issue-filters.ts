import type { DemoIssue, DemoIssueStatus } from "./demo-issues";

// Labels match the existing frontend model. Extra workflow statuses are UI-only.
export const issueStatusLabels: Record<DemoIssueStatus, string> = {
  new: "Новое", accepted: "Принято", assigned: "Назначен исполнитель",
  "in-progress": "В работе", "awaiting-confirmation": "Ожидает подтверждения", completed: "Выполнено",
};

export const issueCategories = [
  "Водоснабжение", "Отопление", "Электричество", "Лифт", "Подъезд",
  "Двор", "Мусор", "Безопасность", "Уборка", "Другое",
] as const;

export type IssueFilters = {
  status: "all" | "active" | DemoIssueStatus;
  category: string;
  entrance: string;
  floor: string;
  zone: string;
  query: string;
  onlyMine?: boolean;
};

export const initialIssueFilters: IssueFilters = {
  status: "all", category: "", entrance: "", floor: "", zone: "", query: "",
};

export function filterIssues(issues: readonly DemoIssue[], filters: IssueFilters) {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  return issues.filter(issue => {
    if (filters.onlyMine && !issue.mine) return false;
    if (filters.status === "active" ? issue.status === "completed" : filters.status !== "all" && issue.status !== filters.status) return false;
    if (filters.category && issue.category !== filters.category) return false;
    if (filters.entrance && issue.place?.entrance !== Number(filters.entrance)) return false;
    if (filters.floor && issue.place?.floor !== Number(filters.floor)) return false;
    if (filters.zone && issue.place?.zone !== filters.zone) return false;
    return !query || `${issue.title} ${issue.description} ${issue.location}`.toLocaleLowerCase("ru").includes(query);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
