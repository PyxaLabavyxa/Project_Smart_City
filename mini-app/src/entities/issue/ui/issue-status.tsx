import type { DemoIssueStatus } from "../model/demo-issues";
import styles from "./issue-status.module.css";

const labels: Record<DemoIssueStatus, string> = {
  new: "Новое",
  accepted: "Принято",
  "in-progress": "В работе",
  completed: "Выполнено",
};

export function IssueStatus({ status }: { status: DemoIssueStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>
    <span aria-hidden="true">{status === "completed" ? "✓" : "●"}</span>
    {labels[status]}
  </span>;
}
