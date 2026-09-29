"use client";
import Link from "next/link";
import { IssueList, useIssues, houseHealthScore } from "@/entities/issue";
import { ReportIssueLink } from "@/features/report-issue";
import { findApartment, useHouseSelection } from "@/entities/house";
import { money, totalCharges, useUtilityAccount } from "@/entities/utilities";
import { useMessages, messageThreads } from "@/entities/message";
import { Icon } from "@/shared/ui/icon";
import { HouseWorks } from "./house-works";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { HousePreview } from "./house-preview";
import { HomeAddress } from "./home-address";
import styles from "./home-page.module.css";

export function HomePage() {
  const { issues, loading: issuesLoading, error: issuesError, reload } = useIssues();
  const { messages } = useMessages();
  const { house } = useHouseSelection();
  const { account, loading, error } = useUtilityAccount();
  const resident = findApartment(house, house.residentApartment);
  const score = houseHealthScore(issues);
  const active = issues.filter(issue => issue.status !== "completed").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const threads = messageThreads(messages).filter(item => item.apartment !== house.residentApartment && findApartment(house, item.apartment));
  return <>
    <header className={styles.heading}><HomeAddress score={issuesLoading || issuesError ? null : score} /><ReportIssueLink /></header>
    <nav className={styles.overview} aria-label="Сервисы квартиры">
      <Link href="/utilities" className={styles.service}><span className={styles.serviceIcon}><Icon name="receipt" /></span><span><strong>ЖКХ</strong><b>{account && resident ? money(totalCharges(account.charges)) : loading ? "Загружаем счёт…" : "Лицевой счёт"}</b><small>{account && resident ? `К оплате до ${account.due}` : error ? "Открыть и повторить загрузку" : "Квитанции и показания"}</small></span><Icon name="arrow" size={16} /></Link>
      <Link href="/messages" className={styles.service}><span className={styles.serviceIcon}><Icon name="messages" /></span><span><strong>Сообщения</strong><b>Переписки с соседями</b><small>{threads.length ? `Диалогов: ${threads.length}` : "Начать разговор"}</small></span><Icon name="arrow" size={16} /></Link>
    </nav>
    <div data-reveal="1" className={styles.layout}>
      <section className={styles.issues} aria-labelledby="active-issues"><div className={styles.sectionHead}><h2 id="active-issues">Актуальные обращения <span>{active.length}</span></h2><Link href="/issues">Все обращения ↗</Link></div>{issuesLoading || issuesError ? <RequestState loading={issuesLoading} error={issuesError} reload={reload} /> : active.length ? <IssueList issues={active.slice(0, 3)} /> : <p className={styles.muted}>Активных обращений нет.</p>}</section>
      <aside className={styles.side}>
        <HousePreview />
      </aside>
    </div>
    <div data-reveal="2" className={styles.secondaryGrid}>
        <HouseWorks />
    </div>
  </>;
}
