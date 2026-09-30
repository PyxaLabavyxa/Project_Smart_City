import type { IssueRecord } from "./issue.ts";

export type HealthPoint = { at: string; score: number | null };

// Moscow calendar days; null means a historical status cannot be reconstructed.
export function healthHistory(issues: readonly IssueRecord[], now = new Date()): HealthPoint[] {
  const day = 86_400_000;
  const offset = 3 * 3_600_000;
  const start = Math.floor((now.getTime() + offset) / day) * day - offset;
  return Array.from({ length: 30 }, (_, index) => {
    const timestamp = index === 29 ? now.getTime() : start - (29 - index) * day + day - 1;
    let penalty = 0;
    let known = true;
    for (const issue of issues) {
      if (Date.parse(issue.createdAt) > timestamp) continue;
      if (index === 29) {
        if (issue.status !== "completed") penalty += issue.priority === "high" ? 10 : 3;
        continue;
      }
      const events = issue.history.filter(event => Date.parse(event.at) <= timestamp)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const status = events.at(-1)?.status;
      if (!status) { known = false; continue; }
      if (status !== "completed") penalty += issue.priority === "high" ? 10 : 3;
    }
    return { at: new Date(timestamp).toISOString(), score: known ? Math.max(0, 100 - penalty) : null };
  });
}
