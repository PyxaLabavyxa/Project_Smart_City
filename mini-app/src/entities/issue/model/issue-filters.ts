import { isOutdoorZone } from "../../house/model/house.ts";
import type { IssueRecord, IssueStateStatus } from "./issue";

export const issueStatusLabels: Record<IssueStateStatus, string> = {
  new: "Новое", accepted: "Принято", assigned: "Назначен исполнитель",
  "in-progress": "В работе", completed: "Решено",
};

export const issueCategories = [
  "Водоснабжение", "Отопление", "Электричество", "Лифт", "Подъезд",
  "Двор", "Мусор", "Безопасность", "Другое",
] as const;

export type IssueFilters = {
  status: "all" | IssueStateStatus;
  category: string;
  entrance: string;
  floor: string;
  zone: string;
  query: string;
  onlyMine?: boolean;
};

export type IssueTab = "all" | "mine";

export const initialIssueFilters: IssueFilters = {
  status: "all", category: "", entrance: "", floor: "", zone: "", query: "",
};

export function issueFiltersFromSearch(params: Pick<URLSearchParams, "get">, houseId: string): IssueFilters {
  if (params.get("house") && params.get("house") !== houseId) return { ...initialIssueFilters };
  const status = params.get("status") ?? "all";
  return {
    status: Object.hasOwn(issueStatusLabels, status) ? status as IssueFilters["status"] : "all",
    category: params.get("category") ?? "", entrance: params.get("entrance") ?? "",
    floor: params.get("floor") ?? "", zone: params.get("zone") ?? "", query: params.get("query") ?? "",
    onlyMine: params.get("mine") === "1",
  };
}

export function issueFiltersSearch(filters: IssueFilters, houseId: string): string {
  const params = new URLSearchParams({ house: houseId });
  for (const key of ["category", "entrance", "floor", "zone", "query"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.onlyMine) params.set("mine", "1");
  return params.toString();
}

export function selectIssueTab(filters: IssueFilters, tab: IssueTab): IssueFilters {
  return { ...filters, onlyMine: tab === "mine" };
}

export function filterIssues(issues: readonly IssueRecord[], filters: IssueFilters) {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  return issues.filter(issue => {
    if (filters.onlyMine && !issue.mine) return false;
    if (filters.status !== "all" && issue.status !== filters.status) return false;
    if (filters.category && issue.category !== filters.category) return false;
    if (filters.entrance && (!issue.place || isOutdoorZone(issue.place.zone) || issue.place.entrance !== Number(filters.entrance))) return false;
    if (filters.floor && (!issue.place || isOutdoorZone(issue.place.zone) || issue.place.floor !== Number(filters.floor))) return false;
    if (filters.zone && issue.place?.zone !== filters.zone) return false;
    return !query || `${issue.title} ${issue.description} ${issue.location}`.toLocaleLowerCase("ru").includes(query);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
