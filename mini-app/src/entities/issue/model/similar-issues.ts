import type { IssueRecord } from "./issue";
import type { HouseLocation } from "@/entities/house";
export function similarIssues(issues: readonly IssueRecord[], place: HouseLocation, category: string) {
  return issues.filter(issue => issue.status !== "completed" && issue.category === category && issue.place?.houseId === place.houseId && issue.place.entrance === place.entrance && issue.place.floor === place.floor && issue.place.zone === place.zone && (place.zone !== "apartment" || (issue.place.zone === "apartment" && issue.place.apartment === place.apartment)));
}
