import { formatIssueDate, type IssueRecord, type IssueStateStatus } from "@/entities/issue";
import styles from "./issue-details.module.css";

const historyLabels: Record<IssueStateStatus, string> = {
  new: "Создано",
  accepted: "Принято",
  assigned: "Назначен исполнитель",
  "in-progress": "В работе",
  "awaiting-confirmation": "Ожидает подтверждения",
  completed: "Выполнено",
};

export function IssueHistory({ issue }: { issue: IssueRecord }) {
  return (
    <section className={styles.history} aria-labelledby="issue-history">
      <h2 id="issue-history">История обращения</h2>
      {!issue.history.length && <p>История изменений этого обращения ещё не записывалась.</p>}
      <ol className={styles.timeline}>
        {issue.history.map((event, index) => (
          <li key={`${event.status}:${event.at}:${index}`} aria-current={index === issue.history.length - 1 ? "step" : undefined}>
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
