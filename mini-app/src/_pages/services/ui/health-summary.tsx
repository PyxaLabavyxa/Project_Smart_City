"use client";
import { demoHealth } from "../model/demo-health";
import { IssueList, useIssues } from "@/entities/issue";
import { Icon } from "@/shared/ui/icon";
import styles from "./health-summary.module.css";
import Link from "next/link";

const categories: Record<string, string> = { water: "Водоснабжение", heating: "Отопление", electricity: "Электричество", elevators: "Лифт", entrances: "Подъезд", territory: "Двор", security: "Безопасность" };

export function HealthSummary() {
  const { issues } = useIssues();
  const completed = issues.filter(issue => issue.status === "completed");
  const problems = issues.filter(issue => issue.status !== "completed" && ["Водоснабжение", "Лифт"].includes(issue.category));
  return <div className={styles.layout}><div>
    <section aria-label="Состояние дома" className={styles.summary}>
      <div className={styles.condition}><p className={styles.score}><strong>{demoHealth.score}</strong><span> / 100</span></p>
      <div><h2>{demoHealth.condition}</h2><p>{demoHealth.summary}</p></div></div>
      <div className={styles.band} aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} data-filled={i < Math.floor(demoHealth.score / 10) || undefined} />)}</div>
      <p className={styles.change}><Icon name="trend" size={17} /> +{demoHealth.score - demoHealth.history[0].score} за месяц</p>
    </section>
    <section aria-labelledby="house-systems">
      <h2 id="house-systems">Системы дома</h2>
      <ul className={styles.systems}>{demoHealth.systems.map(system => <li key={system.id}>
        <Link className={styles.system} href={"/issues?category=" + encodeURIComponent(categories[system.id])} aria-label={`${system.name}: ${system.score} из 100. Обращения по системе`}>
          <div className={styles.row}><h3>{system.name}</h3><span><strong>{system.score}</strong><Icon name="arrow" size={16} /></span></div>
          <div className={styles.bar} role="meter" aria-label={system.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={system.score}><i style={{ width: `${system.score}%`, background: system.score < 80 ? "var(--color-warning)" : "var(--color-teal)" }} /></div>
          <p className={system.score < 80 ? styles.attention : styles.normal}>{system.score < 80 ? "Требует внимания" : "В порядке"}</p>
          {system.score < 80 && <p className={styles.note}>{system.note}</p>}
        </Link>
      </li>)}</ul>
    </section>
  </div><aside className={styles.side}>
    <section><h2>За последние 4 недели</h2><p className={styles.note}>Состояние постепенно улучшается</p>
      <ol className={styles.trend} aria-label="Изменение состояния дома">{demoHealth.history.map(point => <li key={point.date}>
        <strong>{point.score}</strong><div style={{ height: `${(point.score - 50) * 2}px` }} aria-hidden="true" /><time dateTime={point.date}>{point.label}</time>
      </li>)}</ol>
    </section>
    <section><h2>Что влияет на оценку</h2><p className={styles.note}>Количество и серьёзность проблем, повторные обращения и время устранения.</p><p className={styles.note}>Индикатор состояния дома помогает понять, какие системы требуют внимания.</p></section>
    <section><h2>Требуют внимания</h2>{problems.length ? <IssueList issues={problems} /> : <p className={styles.note}>Активных обращений по проблемным системам нет.</p>}</section>
    <section><h2>Последние решения</h2>{completed.length ? <IssueList issues={completed} /> : <p className={styles.note}>Здесь появятся завершённые обращения.</p>}</section>
  </aside></div>;
}
