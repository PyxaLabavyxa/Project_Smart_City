import type { DemoIssueStatus } from "../model/demo-issues";
import styles from "./issue-status.module.css";
import { issueStatusLabels } from "../model/issue-filters";

export function IssueStatus({ status }: { status: DemoIssueStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>
    <span aria-hidden="true">{status === "completed" ? "✓" : "●"}</span>
    {issueStatusLabels[status]}
  </span>;
}
