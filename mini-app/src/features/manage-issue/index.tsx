"use client";
import Link from "next/link";
import type { IssueRecord, IssueStateStatus } from "@/entities/issue";
import styles from "./manage-issue.module.css";
const comments: Record<IssueStateStatus, string> = {
  new: "Обращение ожидает рассмотрения.", accepted: "Обращение принято. Следующий этап — назначение исполнителя.", assigned: "Исполнитель назначен. Следующий этап — начало работ.", "in-progress": "Идут работы по обращению.", completed: "УК отметила обращение как решённое. Если проблема осталась, напишите в чате обращения.",
};
export function IssueWorkflow({ issue }: { issue: IssueRecord }) {
  return <section className={styles.workflow} aria-label="Работа с обращением">
    <h2>Ход работ</h2><p>{comments[issue.status]}</p>
    {(issue.assignee || issue.deadline) && <dl className={styles.facts}><div><dt>Ответственный</dt><dd>{issue.assignee || "Не указан"}</dd></div><div><dt>Ожидаемый срок</dt><dd>{issue.deadline || "Не указан"}</dd></div></dl>}
    {issue.status === "completed" && <Link className={styles.link} href="/health">Посмотреть здоровье дома →</Link>}
  </section>;
}
