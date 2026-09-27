"use client";
import Link from "next/link";
import { IssueList, useIssues, houseHealthScore, formatIssueDate } from "@/entities/issue";
import { ReportIssueLink } from "@/features/report-issue";
import { findApartment, useHouseSelection } from "@/entities/house";
import { useMessages } from "@/entities/message";
import { Icon } from "@/shared/ui/icon";
import { HousePreview } from "./house-preview";
import { homeOverview } from "../model/home-overview";
import styles from "./home-page.module.css";

export function HomePage() {
  const { issues } = useIssues();
  const { messages } = useMessages();
  const { house, select } = useHouseSelection();
  const score = houseHealthScore(issues);
  const active = issues.filter(issue => issue.status !== "completed").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const update = issues.filter(issue => issue.history.length > 1).sort((a, b) => Date.parse(b.history.at(-1)!.at) - Date.parse(a.history.at(-1)!.at))[0];
  const message = messages.filter(item => item.direction === "incoming" && findApartment(house, item.apartment)).at(-1);
  return <>
    <header className={styles.heading}><div><p className={styles.eyeline}>Мой дом <span>›</span> Квартира {house.residentApartment}</p><h1>{house.address}</h1><p>Подъездов: {house.entrances} · этажей: {house.floors}</p></div><ReportIssueLink /></header>
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.today} aria-labelledby="today"><div className={styles.sectionHead}><h2 id="today">Сегодня в доме</h2><Link href="/health">Здоровье дома ↗</Link></div>
          <div className={styles.condition}><div><h3>{score > 82 ? "В доме стало лучше" : homeOverview.condition}</h3><p>{score > 82 ? "Есть подтверждённые решения. Состояние систем обновлено." : homeOverview.summary}</p></div><Link href="/health" className={styles.score} aria-label={`Здоровье дома: ${score} из 100`}><strong>{score}</strong><span>из 100</span></Link></div>
          <div className={styles.statusBottom}><span><b>{active.length}</b> активных проблем</span><span>✓ Состояние под контролем</span></div>
        </section>
        <section className={styles.issues} aria-labelledby="active-issues"><div className={styles.sectionHead}><h2 id="active-issues">Обращения в доме <span>{active.length}</span></h2><Link href="/issues">Все ↗</Link></div>{active.length ? <IssueList issues={active.slice(0, 3)} /> : <p className={styles.muted}>Все проблемы решены.</p>}</section>
        <nav className={styles.quick} aria-label="Быстрые действия">{([{ href: "/plan", title: "План дома", icon: "plan" }, { href: "/cameras", title: "Камеры", icon: "cameras" }, { href: "/messages?from=home", title: "Сообщения", icon: "messages" }] as const).map(item => <Link key={item.href} href={item.href}><Icon name={item.icon} /><span>{item.title}</span><span aria-hidden="true">↗</span></Link>)}</nav>
        {update && <section className={styles.update} aria-label="Последнее обновление"><Icon name="check" /><div><h3>Обновление по обращению</h3><Link href={`/issues/${update.id}`}>{update.title}</Link><p>{formatIssueDate(update.history.at(-1)!.at)}</p></div></section>}
      </div>
      <div className={styles.side}>
        <HousePreview />
        <section className={styles.schedule} aria-labelledby="works"><div className={styles.sectionHead}><h2 id="works">Ближайшие работы</h2><Icon name="calendar" /></div>{homeOverview.works.map(work => <div key={work.title} className={styles.work}><time dateTime={work.date}><strong>{work.day}</strong><small>сентября</small></time><div><h3>{work.title}</h3><p>{work.time} · {work.location}</p>{work.note && <p>{work.note}</p>}</div></div>)}</section>
        {message && <section className={styles.message}><div className={styles.sectionHead}><h3><Icon name="messages" /> Сообщение из кв. {message.apartment}</h3></div><p>«{message.text}»</p><Link href="/messages?from=home" onClick={() => { const place = findApartment(house, message.apartment); if (place) select(place); }}>Открыть сообщение →</Link></section>}
      </div>
    </div>
  </>;
}
