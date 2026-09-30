"use client";
import { useState } from "react";
import { useIssues, houseHealthScore, issueCategories } from "@/entities/issue";
import { healthHistory } from "@/entities/issue/model/health-history";
import { RequestState } from "@/shared/ui/navigation/request-state";
import styles from "./health-summary.module.css";
import Link from "next/link";

const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });

export function HealthSummary() {
  const { issues, loading, error, reload } = useIssues();
  const [selected, select] = useState(29);
  if (loading || error) return <RequestState loading={loading} error={error} reload={reload} />;
  const score = houseHealthScore(issues);
  const problems = issues.filter(issue => issue.status !== "completed");
  const history = healthHistory(issues);
  const point = history[selected];
  const path = history.map((point, index) => {
    if (point.score === null) return "";
    const command = index > 0 && history[index - 1].score !== null ? "L" : "M";
    return `${command}${40 + index * 10},${160 - point.score * 1.3}`;
  }).join(" ");
  return <div className={styles.layout}>
    <section aria-label="Состояние дома" className={styles.summary}>
      <p className={styles.score}><strong>{score}</strong><span> / 100</span></p>
      <div><h2>{problems.length ? "Есть вопросы, требующие внимания" : "В доме всё спокойно"}</h2><p>{problems.length ? `Открытых обращений: ${problems.length}` : "Открытых обращений нет"}</p></div>
    </section>
    <section className={styles.history} aria-labelledby="health-history">
      <div className={styles.heading}><h2 id="health-history">История здоровья</h2><span>30 дней</span></div>
      <p className={styles.readout} aria-live="polite">{date.format(new Date(point.at))} · {point.score === null ? "Недостаточно истории" : `${point.score} из 100`}</p>
      <svg className={styles.chart} viewBox="0 0 350 190" role="slider" tabIndex={0}
        aria-label="История здоровья. Нажмите на график, чтобы выбрать дату. С клавиатуры используйте стрелки."
        aria-valuemin={0} aria-valuemax={29} aria-valuenow={selected}
        aria-valuetext={`${date.format(new Date(point.at))}: ${point.score === null ? "недостаточно истории" : `${point.score} из 100`}`}
        onClick={event => {
          const matrix = event.currentTarget.getScreenCTM();
          if (!matrix) return;
          const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          select(Math.max(0, Math.min(29, Math.round((local.x - 40) / 10))));
        }}
        onKeyDown={event => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? 29 :
            event.key === "ArrowLeft" || event.key === "ArrowDown" ? selected - 1 :
            event.key === "ArrowRight" || event.key === "ArrowUp" ? selected + 1 : null;
          if (next === null) return;
          event.preventDefault();
          select(Math.max(0, Math.min(29, next)));
        }}>
        {[0, 50, 100].map(value => <g key={value}><line x1="40" x2="330" y1={160 - value * 1.3} y2={160 - value * 1.3} /><text x="28" y={164 - value * 1.3} textAnchor="end">{value}</text></g>)}
        <line className={styles.marker} x1={40 + selected * 10} x2={40 + selected * 10} y1="30" y2="160" />
        <path d={path} />
        {point.score !== null && <circle cx={40 + selected * 10} cy={160 - point.score * 1.3} r="4" />}
        <text x="40" y="185">{date.format(new Date(history[0].at))}</text><text x="330" y="185" textAnchor="end">Сегодня</text>
      </svg>
      <p className={styles.hint}>Нажмите на график, чтобы узнать дату и балл.</p>
      <p className={styles.note}>По истории доступных вам обращений, с текущими приоритетами. Без истории статусов оставляем пробел на графике.</p>
    </section>
    <section aria-labelledby="house-systems" className={styles.categories}><h2 id="house-systems">По категориям</h2>
      <ul className={styles.systems}>{issueCategories.map(category => {
        const active = problems.filter(issue => issue.category === category).length;
        return <li key={category}><Link className={styles.system} href={"/issues?category=" + encodeURIComponent(category)}><span>{category}</span><span data-active={active > 0 || undefined}>{active ? `${active} открыто` : "Всё спокойно"}</span></Link></li>;
      })}</ul>
    </section>
    <p className={styles.note}>Индикатор по обращениям, а не датчикам: из 100 вычитаем 3 балла за обычное активное обращение и 10 за высокий приоритет.</p>
  </div>;
}
