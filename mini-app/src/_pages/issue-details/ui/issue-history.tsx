import { formatIssueDate, type DemoIssue, type DemoIssueStatus } from "@/entities/issue";
import styles from "./issue-details.module.css";

const historyLabels: Record<DemoIssueStatus, string> = {
  new: "Создано",
  accepted: "Принято УК",
  "in-progress": "В работе",
  completed: "Выполнено",
};

export function IssueHistory({ issue }: { issue: DemoIssue }) {
  return (
    <section className={styles.history} aria-labelledby="issue-history">
      <h2 id="issue-history">История обращения</h2>
      <ol className={styles.timeline}>
        {issue.history.map((event, index) => (
          <li key={event.status} aria-current={index === issue.history.length - 1 ? "step" : undefined}>
            <span className={styles.marker} aria-hidden="true">{index === issue.history.length - 1 ? "●" : "✓"}</span>
            <h3>{historyLabels[event.status]}</h3>
            <time dateTime={event.at}>{formatIssueDate(event.at)}</time>
            {index === issue.history.length - 1 ? <span className={styles.current}>Текущий статус</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
