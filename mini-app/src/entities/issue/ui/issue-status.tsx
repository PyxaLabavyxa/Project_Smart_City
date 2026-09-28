import type { IssueStateStatus } from "../model/issue";
import styles from "./issue-status.module.css";
import { issueStatusLabels } from "../model/issue-filters";

export function IssueStatus({ status }: { status: IssueStateStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>
    <span aria-hidden="true">{status === "completed" ? "✓" : "●"}</span>
    {issueStatusLabels[status]}
  </span>;
}
