"use client";
import { useState } from "react";
import { findApartment, useHouseSelection } from "@/entities/house";
import { money, totalCharges, useUtilityAccount, invoiceDue, invoicePeriod } from "@/entities/utilities";

import { Icon } from "@/shared/ui/icon";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { SectionLoading } from "@/shared/ui/navigation/section-loading";
import { HomeAddress } from "@/_pages/home/ui/home-address";
import { useOnboarding } from "@/features/onboarding/onboarding-context";
import { Payment } from "./payment";
import { Meters } from "./meters";
import styles from "./utilities.module.css";

export function UtilitiesPage() {
 const { house } = useHouseSelection();
 const { account, loading, error, reload, saveReading } = useUtilityAccount();
 const { activeTarget } = useOnboarding();
 const [downloadNotice,setDownloadNotice] = useState("");
 const [tab,setTab] = useState<"bill" | "meters">("bill");
 const currentTab = activeTarget === "meter-reading" ? "meters" : activeTarget === "utility-bill" ? "bill" : tab;
 const apartment = findApartment(house,house.residentApartment);
 const total = account ? totalCharges(account.charges) : 0;
 return <div className={styles.page}>
  <h1>ЖКХ</h1>
  <HomeAddress compact apartmentOnly />
  <div className={styles.tabs} role="group" aria-label="Раздел ЖКХ"><button type="button" aria-pressed={currentTab === "bill"} onClick={() => setTab("bill")}>Квитанции</button><button type="button" aria-pressed={currentTab === "meters"} onClick={() => setTab("meters")}>Показания</button></div>
  {loading ? <SectionLoading label="Загружаем лицевой счёт…" /> : error || !account ? <section className={styles.panel}><p role={error ? "alert" : "status"}>{error || "Лицевой счёт пока не подключён."}</p><RefreshButton className={styles.secondary} onRefresh={reload} loading={loading}>Повторить</RefreshButton></section> : !apartment ? <section className={styles.panel}><h2>Квартира не найдена</h2><p>Проверьте привязку квартиры к дому.</p></section> : currentTab === "bill" ? <div className={styles.content}>
   <div className={styles.layout}>
    <section data-tour="utility-bill" className={styles.panel} aria-labelledby="bill-title">
     <div className={styles.billHeading}><h2 id="bill-title">{invoicePeriod(account.period) || "Квитанция пока не выставлена"}</h2>{account.invoiceNumber && <span className={styles.badge}>Не оплачено</span>}</div>
     {account.invoiceNumber && <p className={styles.muted}>Квитанция № {account.invoiceNumber}</p>}
     <p className={styles.amount}>{money(total)}</p>{account.due && <p>Оплатить до {invoiceDue(account.due)}</p>}
     <ul className={styles.charges}>{account.charges.slice(0,4).map(charge => <li key={charge.title}><div><strong>{charge.title}</strong></div><b>{money(charge.amount)}</b></li>)}</ul>
     {account.charges.length > 4 && <details className={styles.chargeDetails}><summary>Все начисления · {account.charges.length}</summary><ul className={styles.charges}>{account.charges.slice(4).map(charge => <li key={charge.title}><strong>{charge.title}</strong><b>{money(charge.amount)}</b></li>)}</ul></details>}
     {account.invoiceNumber && total > 0 && <Payment amount={total} apartment={house.residentApartment} period={account.period} invoiceNumber={account.invoiceNumber} address={house.address} entrance={apartment.entrance} floor={apartment.floor} />}
     <button type="button" className={styles.download} onClick={() => setDownloadNotice("PDF-квитанции пока не подключены. Начисления доступны на этом экране.")}><Icon name="download" />Скачать квитанцию</button>
     {downloadNotice && <p className={styles.feedback} role="status">{downloadNotice}</p>}
    </section>
    <aside className={styles.account}><div className={styles.accountHeading}><span className={styles.accountIcon}><Icon name="building" size={28} /></span><div><h2>Квартира {house.residentApartment}</h2><p>{house.address}</p><p className={styles.muted}>Подъезд {apartment.entrance} · Этаж {apartment.floor}</p></div></div><dl className={styles.totals}><div><dt>Лицевой счёт</dt><dd>{account.number}</dd></div></dl></aside>
   </div>
  </div> : <Meters key={`${house.id}:${house.residentApartment}:${account.readingPeriod}`} meters={account.meters} apartment={house.residentApartment} period={account.readingPeriod} readingOpen={account.readingOpen} readingClose={account.readingClose} readingAvailable={account.readingAvailable} onSave={saveReading} />}
 </div>;
}
