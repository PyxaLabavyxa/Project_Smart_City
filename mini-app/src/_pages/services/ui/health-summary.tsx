import { demoHealth } from "../model/demo-health";
import styles from "./health-summary.module.css";
import Link from "next/link";

const categories: Record<string, string> = { water: "Водоснабжение", heating: "Отопление", electricity: "Электричество", elevators: "Лифт", entrances: "Подъезд", territory: "Двор", security: "Безопасность" };

export function HealthSummary() {
  return <>
    <section aria-label="Состояние дома" className={styles.summary}>
      <p className={styles.score}><strong>{demoHealth.score}</strong> / 100</p>
      <h2>{demoHealth.condition}</h2><p>{demoHealth.summary}</p>
    </section>
    <section aria-labelledby="house-systems">
      <h2 id="house-systems">Системы дома</h2>
      <ul className={styles.systems}>{demoHealth.systems.map(system => <li key={system.id}>
        <div className={styles.row}><h3>{system.name}</h3><strong>{system.score} / 100</strong></div>
        <p className={system.score < 80 ? styles.attention : styles.normal}>{system.score < 80 ? "Требует внимания" : "В порядке"}</p>
        <meter min={0} max={100} value={system.score} aria-label={system.name} />
        <p className={styles.note}>{system.note}</p>
        <Link className={styles.issueLink} href={"/issues?category=" + encodeURIComponent(categories[system.id])}>Обращения по системе →</Link>
      </li>)}</ul>
    </section>
  </>;
}
