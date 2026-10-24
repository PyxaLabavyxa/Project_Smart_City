"use client";
import Link from "next/link";
import { IssueList, useIssues, houseHealthScore } from "@/entities/issue";
import { findApartment, useHouseSelection } from "@/entities/house";
import { money, totalCharges, useUtilityAccount, invoiceDue } from "@/entities/utilities";
import { useMessages, messageThreads } from "@/entities/message";
import { Icon } from "@/shared/ui/icon";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { HousePreview } from "./house-preview";
import { HouseWorks } from "./house-works";
import { HouseArt } from "@/shared/ui/house-art";
import { HomeAddress } from "./home-address";
import styles from "./home-page.module.css";

export function HomePage() {
 const { issues, loading: issuesLoading, error: issuesError, reload } = useIssues();
 const { messages, loading: messagesLoading, error: messagesError } = useMessages();
 const { house, apartmentsState } = useHouseSelection();
 const { account, loading, error } = useUtilityAccount();
 const resident = findApartment(house, house.residentApartment);
 const score = houseHealthScore(issues);
 const active = issues.filter(issue => issue.status !== "completed").sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
 const threads = messageThreads(messages).filter(item => item.apartment !== house.residentApartment && findApartment(house,item.apartment));
 return <div className={styles.dashboard}>
  <header data-tour="home-overview" className={styles.heading}><HouseArt className={styles.houseIllustration} /><HomeAddress /></header>
  <div data-tour="home-health" className={styles.healthCard}>
   <Link data-tour="house-health" href="/health" className={styles.healthLink}><strong>{issuesLoading || issuesError ? "—" : score}<small>/100</small><Icon name="arrow" size={18} /></strong><span>Здоровье дома</span></Link>
   <Link href="/issues" className={styles.activeCount}><strong>{issuesLoading || issuesError ? "—" : active.length}</strong><span>активных<br />обращений</span></Link>
  </div>
  <nav className={styles.overview} aria-label="Сервисы квартиры">
   <Link href="/utilities" className={styles.service}><span className={styles.serviceLabel}><span className={styles.serviceIcon}><Icon name="receipt" /></span>ЖКХ<Icon name="arrow" size={15} /></span><b>{account && resident ? money(totalCharges(account.charges)) : loading ? "Загружаем…" : "Лицевой счёт"}</b><small>{account && resident ? `До ${invoiceDue(account.due)}` : error ? "Повторить загрузку" : "Квитанции и показания"}</small></Link>
   <Link href="/messages" className={styles.service}><span className={styles.serviceLabel}><span className={styles.serviceIcon}><Icon name="messages" /></span>Сообщения<Icon name="arrow" size={15} /></span><b className={styles.messageTitle}>{apartmentsState.loading || messagesLoading ? "Загружаем…" : apartmentsState.error || messagesError ? "Повторить загрузку" : threads.length ? `Диалогов: ${threads.length}` : "Нет новых сообщений"}</b></Link>
  </nav>
  <section className={styles.issues} aria-labelledby="active-issues"><div className={styles.sectionHead}><h2 id="active-issues">Обращения в доме</h2><Link href="/issues">Все {active.length} <Icon name="arrow" size={16} /></Link></div>{issuesLoading || issuesError ? <RequestState loading={issuesLoading} error={issuesError} reload={reload} /> : active.length ? <IssueList issues={active.slice(0,3)} /> : <p className={styles.empty}>Активных обращений нет. В доме всё спокойно.</p>}</section>
  <div className={styles.homeHouse}><HousePreview showHeading /></div>
  <HouseWorks />
 </div>;
}
