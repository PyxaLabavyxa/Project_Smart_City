import { changeLocationFilter, isOutdoorZone, type House, type HouseLocation, type LocationFilterValues } from "../../house/model/house.ts";
import { categoriesForPlace, reportCategoryLabel } from "./report-categories.ts";
import type { IssueRecord, IssueStateStatus } from "./issue";

export const issueStatusLabels: Record<IssueStateStatus, string> = {
  new: "Новое", accepted: "Принято", assigned: "Поручено",
  "in-progress": "В работе", completed: "Решено",
};

export const issueCategories = [
  "Водоснабжение", "Отопление", "Электричество", "Лифт", "Подъезд",
  "Двор", "Мусор", "Безопасность", "Другое",
] as const;

export const issueFilterZones: readonly HouseLocation["zone"][] = ["corridor", "stairs", "elevator", "technical", "entrance", "courtyard", "parking", "apartment"];

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

function zoneMatches(zone: HouseLocation["zone"], category: string, entrance: string, floor: string) {
  if (category && !categoriesForPlace({ zone }).some(item => item.value === category)) return false;
  if (isOutdoorZone(zone)) return !entrance && !floor;
  return zone !== "entrance" || !floor || floor === "1";
}

export function availableIssueZones(filters: Pick<IssueFilters, "zone" | "category" | "entrance" | "floor">) {
  // Floor 1 belongs to the entrance itself; its disabled field is not a separate choice.
  const floor = filters.zone === "entrance" ? "" : filters.floor;
  return issueFilterZones.filter(zone => zoneMatches(zone, filters.category, filters.entrance, floor));
}

export function availableIssueCategories(zone: string, location: Pick<IssueFilters, "entrance" | "floor"> = { entrance: "", floor: "" }): readonly string[] {
  const selected = issueFilterZones.find(item => item === zone);
  if (selected) {
    return categoriesForPlace({ zone: selected }).filter(item => zoneMatches(selected, item.value, location.entrance, location.floor)).map(item => item.value);
  }
  return issueCategories.filter(category => issueFilterZones.some(place => zoneMatches(place, category, location.entrance, location.floor)));
}

export function issueFilterCategoryLabel(category: string, zone: string) {
  const selected = issueFilterZones.find(item => item === zone);
  return selected ? reportCategoryLabel({ zone: selected }, category) : category === "Подъезд" ? "Двери и общие зоны" : category;
}

export function normalizeIssueFilters(filters: IssueFilters, house: Pick<House, "entrances" | "floors">): IssueFilters {
  const zone = issueFilterZones.some(zone => zone === filters.zone) ? filters.zone : "";
  const validNumber = (value: string, max: number) => /^[1-9]\d*$/.test(value) && Number(value) <= max ? value : "";
  const entrance = isOutdoorZone(zone) ? "" : validNumber(filters.entrance, house.entrances);
  const floor = isOutdoorZone(zone) ? "" : zone === "entrance" ? "1" : validNumber(filters.floor, house.floors);
  return {
    ...filters,
    status: Object.hasOwn(issueStatusLabels, filters.status) ? filters.status : "all",
    zone,
    category: availableIssueCategories(zone, { entrance, floor }).includes(filters.category) ? filters.category : "",
    entrance,
    floor,
  };
}

export function changeIssueLocationFilter(filters: IssueFilters, key: keyof LocationFilterValues, value: string, house: Pick<House, "entrances" | "floors">): IssueFilters {
  const next = key === "zone" ? changeLocationFilter(filters, key, value) : { ...filters, [key]: value };
  if (key === "zone" && filters.zone === "entrance" && next.zone !== "entrance") next.floor = "";
  if (key !== "zone" && value && (isOutdoorZone(next.zone) || key === "floor" && value !== "1" && next.zone === "entrance")) next.zone = "";
  return normalizeIssueFilters(next, house);
}

export function changeIssueCategoryFilter(filters: IssueFilters, category: string, house: Pick<House, "entrances" | "floors">): IssueFilters {
  const next = { ...filters, category };
  if (category && next.zone && !availableIssueCategories(next.zone).includes(category)) {
    if (next.zone === "entrance") next.floor = "";
    next.zone = "";
  }
  if (category && !availableIssueCategories("", next).includes(category)) next.entrance = next.floor = "";
  return normalizeIssueFilters(next, house);
}

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
    return !query || `${issue.title} ${issue.description} ${issue.location} ${reportCategoryLabel(issue.place, issue.category)}`.toLocaleLowerCase("ru").includes(query);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
