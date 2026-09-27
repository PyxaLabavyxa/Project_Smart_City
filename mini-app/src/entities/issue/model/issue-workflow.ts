import { demoIssues, type DemoIssue, type DemoIssueStatus } from "./demo-issues.ts";

export function withStatus(issue: DemoIssue, status: DemoIssueStatus, at: string): DemoIssue {
  return issue.status === status ? issue : { ...issue, status, history: [...issue.history, { status, at }] };
}
export function resolvedDelta(issues: readonly DemoIssue[], category?: string) {
  const count = (list: readonly DemoIssue[]) => list.filter(issue => issue.status === "completed" && (!category || issue.category === category)).length;
  return count(issues) - count(demoIssues);
}
export function houseHealthScore(issues: readonly DemoIssue[]) { return Math.max(0, Math.min(100, 82 + resolvedDelta(issues) * 3)); }
