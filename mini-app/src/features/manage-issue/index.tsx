"use client";
import { useState } from "react";
import Link from "next/link";
import { useIssues, issueStatusLabels, type DemoIssue, type DemoIssueStatus } from "@/entities/issue";
import styles from "./manage-issue.module.css";
const comments: Record<DemoIssueStatus, string> = {
  new: "Обращение ожидает рассмотрения.", accepted: "Обращение принято. Следующий этап — назначение исполнителя.", assigned: "Исполнитель назначен. Следующий этап — начало работ.", "in-progress": "Идут работы по обращению.", "awaiting-confirmation": "Работы завершены. Проверьте, устранена ли проблема.", completed: "Решение подтверждено. Обращение закрыто.",
};
export function IssueWorkflow({ issue }: { issue: DemoIssue }) {
  const { respondToResolution } = useIssues();
  const [feedback, setFeedback] = useState("");
  function update(status: "completed" | "in-progress") { respondToResolution(issue.id, status); setFeedback("Статус изменён: " + issueStatusLabels[status]); }
  return <section className={styles.workflow} aria-label="Работа с обращением">
    <h2>Ход работ</h2><p>{comments[issue.status]}</p>
    {(issue.assignee || issue.deadline) && <dl className={styles.facts}><div><dt>Ответственный</dt><dd>{issue.assignee || "Не указан"}</dd></div><div><dt>Ожидаемый срок</dt><dd>{issue.deadline || "Не указан"}</dd></div></dl>}
    {issue.mine && issue.status === "awaiting-confirmation" && <div className={styles.confirm}><h3>Проверить результат</h3><p>Проблема действительно устранена?</p><div className={styles.actions}><button type="button" className={styles.primary} onClick={() => update("completed")}>Да, всё исправлено</button><button type="button" className={styles.button} onClick={() => update("in-progress")}>Проблема осталась</button></div></div>}
    {issue.status === "completed" && <Link className={styles.link} href="/health">Посмотреть здоровье дома →</Link>}
    <p role="status" className={styles.feedback}>{feedback}</p>
  </section>;
}
