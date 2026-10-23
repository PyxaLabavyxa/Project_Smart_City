import Link from "next/link";
import { SuccessMark } from "@/shared/ui/success-mark";
import { IssueStatus, type IssueRecord } from "@/entities/issue";
import styles from "./issue-created.module.css";
export function IssueCreated({ issue, onOpen }: { issue: IssueRecord; onOpen: () => void }) {
 return <section data-issue-created className={styles.success} aria-labelledby="created-title">
  <SuccessMark className={styles.celebration} />
  <h1 id="created-title">Обращение отправлено</h1><p className={styles.subtitle}>Номер обращения №{issue.id}.<br />УК получила ваше сообщение.</p>
  <div className={styles.card}><div className={styles.row}><h2>{issue.title}</h2><IssueStatus status={issue.status} /></div><p>{issue.category} · {issue.location}</p>
   <ol><li><strong>Принято</strong><p>Обращение сохранено и передано в управляющую компанию.</p></li><li><strong>Назначение исполнителя</strong><p>УК назначит ответственного и сообщит сроки выполнения.</p></li><li><strong>Решение</strong><p>Вы получите уведомление, когда проблема будет решена.</p></li></ol>
  </div>
  <button type="button" className={styles.primary} onClick={onOpen}>Открыть обращение</button><Link href="/" className={styles.secondary} onClick={onOpen}>Вернуться домой</Link>
 </section>;
}
