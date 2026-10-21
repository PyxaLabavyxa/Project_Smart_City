import type { IssueRecord, IssueStateStatus } from "./issue.ts";

export function canDeleteIssue(issue: Pick<IssueRecord, "mine" | "status" | "history">) {
  return issue.mine && issue.status === "new" && issue.history.every(event => event.status === "new");
}

export function withStatus(issue: IssueRecord, status: IssueStateStatus, at: string): IssueRecord {
  return issue.status === status ? issue : { ...issue, status, history: [...issue.history, { status, at }] };
}
export function houseHealthScore(issues: readonly IssueRecord[]) {
  return Math.max(0, 100 - issues.reduce((sum, issue) => sum + (issue.status === "completed" ? 0 : issue.priority === "high" ? 10 : 3), 0));
}
