"use client";
import { IssueList, useIssues, houseHealthScore, issueCategories } from "@/entities/issue";
import { RequestState } from "@/shared/ui/navigation/request-state";
import styles from "./health-summary.module.css";
import Link from "next/link";

export function HealthSummary() {
  const { issues, loading, error, reload } = useIssues();
  if (loading || error) return <RequestState loading={loading} error={error} reload={reload} />;
  const score = houseHealthScore(issues);
  const problems = issues.filter(issue => issue.status !== "completed");
  return <div className={styles.layout}><div>
    <section aria-label="Состояние дома" className={styles.summary}>
      <div className={styles.condition}><p className={styles.score}><strong>{score}</strong><span> / 100</span></p>
      <div><h2>{problems.length ? "Есть открытые обращения" : "Открытых обращений нет"}</h2><p>Индикатор по доступным вам обращениям.</p></div></div>
      <p className={styles.note}>Из 100 баллов вычитается 3 за обычное активное обращение и 10 за обращение высокого приоритета. Это не показания датчиков.</p>
    </section>
    <section aria-labelledby="house-systems"><h2 id="house-systems">По категориям</h2>
      <ul className={styles.systems}>{issueCategories.map(category => {
        const active = problems.filter(issue => issue.category === category).length;
        return <li key={category}><Link className={styles.system} href={"/issues?category=" + encodeURIComponent(category)}><div className={styles.row}><h3>{category}</h3><strong>{active}</strong></div><p>{active ? "Активных обращений" : "Открытых обращений нет"}</p></Link></li>;
      })}</ul>
    </section>
  </div><aside className={styles.side}><section><h2>Требуют внимания</h2>{problems.length ? <IssueList issues={problems} /> : <p className={styles.note}>Проблемы не зарегистрированы.</p>}</section></aside></div>;
}
