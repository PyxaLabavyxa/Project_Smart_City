"use client";
import { useState } from "react";
import { useIssues, houseHealthScore, issueCategories } from "@/entities/issue";
import { healthHistory } from "@/entities/issue/model/health-history";
import { RequestState } from "@/shared/ui/navigation/request-state";
import styles from "./health-summary.module.css";
import Link from "next/link";
import { IssueCategoryIcon } from "@/entities/issue/ui/issue-category-icon";
import { Icon } from "@/shared/ui/icon";

const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });

export function HealthSummary() {
  const { issues, loading, error, reload } = useIssues();
  const [selected, select] = useState(29);
  const [days,setDays]=useState(30);
  if (loading || error) return <RequestState loading={loading} error={error} reload={reload} />;
  const score = houseHealthScore(issues);
  const problems = issues.filter(issue => issue.status !== "completed");
  const history = healthHistory(issues).slice(-days);
  const selectedIndex=Math.min(selected,history.length-1);
  const point = history[selectedIndex];
  const spacing=290 / (history.length-1);
  const markerX=40+selectedIndex*spacing;
  const tooltipY=point.score === null ? 70 : Math.max(55,Math.min(120,160-point.score*1.3+26));
  const path = history.map((point, index) => {
    if (point.score === null) return "";
    const command = index > 0 && history[index - 1].score !== null ? "L" : "M";
    return `${command}${40 + index * spacing},${160 - point.score * 1.3}`;
  }).join(" ");
  return <div className={styles.layout}>
    <section aria-label="Состояние дома" className={styles.summary}>
      <Link href="/issues" className={styles.score}><span><strong>{score}/100</strong><Icon name="arrow" size={20} /></span><p>Открытых обращений: {problems.length}</p></Link>
      <div><h2>{problems.length ? "Есть вопросы, требующие внимания" : "В доме всё спокойно"}</h2></div>
    </section>
    <section className={styles.history} aria-labelledby="health-history">
      <div className={styles.heading}><h2 id="health-history">История здоровья</h2><select aria-label="Период истории здоровья" value={days} onChange={event=>{const next=Number(event.target.value);setDays(next);select(next-1);}}><option value={30}>30 дней</option><option value={14}>14 дней</option><option value={7}>7 дней</option></select></div>
      <p className={styles.readout} aria-live="polite">{date.format(new Date(point.at))} · {point.score === null ? "Недостаточно истории" : `${point.score} из 100`}</p>
      <svg className={styles.chart} viewBox="0 0 350 190" role="slider" tabIndex={0}
        aria-label="История здоровья. Нажмите на график, чтобы выбрать дату. С клавиатуры используйте стрелки."
        aria-valuemin={0} aria-valuemax={history.length-1} aria-valuenow={selectedIndex}
        aria-valuetext={`${date.format(new Date(point.at))}: ${point.score === null ? "недостаточно истории" : `${point.score} из 100`}`}
        onClick={event => {
          const matrix = event.currentTarget.getScreenCTM();
          if (!matrix) return;
          const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          select(Math.max(0, Math.min(history.length-1, Math.round((local.x - 40) / spacing))));
        }}
        onKeyDown={event => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? history.length-1 :
            event.key === "ArrowLeft" || event.key === "ArrowDown" ? selectedIndex - 1 :
            event.key === "ArrowRight" || event.key === "ArrowUp" ? selectedIndex + 1 : null;
          if (next === null) return;
          event.preventDefault();
          select(Math.max(0, Math.min(history.length-1, next)));
        }}>
        {[0, 50, 100].map(value => <g key={value}><line x1="40" x2="330" y1={160 - value * 1.3} y2={160 - value * 1.3} /><text x="28" y={164 - value * 1.3} textAnchor="end">{value}</text></g>)}
        <line className={styles.marker} x1={markerX} x2={markerX} y1="30" y2="160" />
        <path d={path} />
        {point.score !== null && <circle cx={markerX} cy={160 - point.score * 1.3} r="4" />}
        {point.score !== null && <text className={styles.tooltip} x={Math.max(82,Math.min(310,markerX))} y={tooltipY} textAnchor="middle"><tspan x={Math.max(82,Math.min(310,markerX))}>{selectedIndex===history.length-1 ? "Сегодня" : date.format(new Date(point.at))}</tspan><tspan className={styles.tooltipScore} x={Math.max(82,Math.min(310,markerX))} dy="20">{point.score}</tspan></text>}
        <text x="40" y="185">{date.format(new Date(history[0].at))}</text><text x="330" y="185" textAnchor="end">Сегодня</text>
      </svg>
      <p className={styles.hint}>Чем выше оценка, тем лучше состояние дома.</p>
    </section>
    <section aria-labelledby="house-systems" className={styles.categories}><h2 id="house-systems">Системы дома</h2>
      <ul className={styles.systems}>{["Лифт","Электричество","Водоснабжение",...issueCategories.filter(item=>!["Лифт","Электричество","Водоснабжение"].includes(item))].map(category => {
        const active = problems.filter(issue => issue.category === category).length;
        const label=category === "Лифт" ? "Лифты" : category === "Электричество" ? "Электрика" : category;
        const description=category === "Лифт" ? "Пассажирские и грузовые" : category === "Электричество" ? "Освещение, щитовые" : category === "Водоснабжение" ? "Холодная и горячая вода" : "Обращения по категории";
        return <li key={category}><Link className={styles.system} href={"/issues?category=" + encodeURIComponent(category)}><span className={styles.systemName}><span className={styles.systemIcon}><IssueCategoryIcon category={category} /></span><span><strong>{label}</strong><small>{description}</small></span></span><span data-active={active > 0 || undefined}>{active ? "Есть обращения" : "В норме"}</span><Icon name="arrow" size={16} /></Link></li>;
      })}</ul>
    </section>

  </div>;
}
