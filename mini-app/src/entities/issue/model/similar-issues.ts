import type { IssueRecord } from "./issue";
import { sameLocation, type HouseLocation } from "../../house/model/house.ts";
export function similarIssues(issues: readonly IssueRecord[], place: HouseLocation, category: string) {
  return issues.filter(issue => issue.status !== "completed" && issue.category === category && sameLocation(issue.place, place));
}
