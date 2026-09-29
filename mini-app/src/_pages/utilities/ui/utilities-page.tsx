"use client";

import { findApartment, useHouseSelection } from "@/entities/house";
import { money, totalCharges, useUtilityAccount } from "@/entities/utilities";

import { SectionPage } from "@/shared/ui/navigation";
import { Icon } from "@/shared/ui/icon";
import { Payment } from "./payment";
import { Meters } from "./meters";
import styles from "./utilities.module.css";

export function UtilitiesPage() {
  const { house } = useHouseSelection();

  const key = `${house.id}:${house.residentApartment}`;
  const { account, loading, error, reload, saveReading } = useUtilityAccount();
  if (loading || error || !account) return <SectionPage title="ЖКХ" description="Квитанции и показания вашей квартиры" backHref="/" backLabel="На главную"><section className={styles.panel} aria-busy={loading}><p role={error ? "alert" : "status"}>{loading ? "Загружаем лицевой счёт…" : error || "Лицевой счёт пока не подключён."}</p>{!loading && <button className={styles.secondary} onClick={reload}>Повторить</button>}</section></SectionPage>;
  const total = totalCharges(account.charges);
  const apartment = findApartment(house, house.residentApartment);
  return <SectionPage title="ЖКХ" description="Квитанции и показания вашей квартиры" backHref="/" backLabel="На главную">
    <div className={styles.content}>

    {!apartment ? <section className={styles.panel}><h2>Квартира не найдена</h2><p>Проверьте структуру дома: квартира {house.residentApartment} в ней отсутствует. Начисления и счётчики недоступны.</p></section> : <>
      <div className={styles.layout}>
        <section data-tour="utility-bill" className={styles.panel} aria-labelledby="bill-title">
          <div className={styles.row}><h2 id="bill-title">{account.period || "Квитанция пока не выставлена"}</h2></div>
          {account.invoiceNumber && <p className={styles.muted}>Квитанция № {account.invoiceNumber}</p>}
          <p className={styles.amount}>{money(total)}</p>
          {account.due && <p>Оплатить до {account.due}</p>}
          <p className={styles.muted}>Сумма по строкам квитанции</p>
          {account.invoiceNumber && total > 0 && <Payment amount={total} apartment={house.residentApartment} period={account.period} />}
        </section>
        <aside className={styles.account}><span className={styles.accountIcon}><Icon name="home" size={28} /></span><h2>Квартира {house.residentApartment}</h2><p>{house.address}</p><p className={styles.muted}>Подъезд {apartment.entrance} · этаж {apartment.floor}</p><dl className={styles.totals}><div><dt>Лицевой счёт</dt><dd>{account.number}</dd></div><div><dt>Площадь</dt><dd>{account.area} м²</dd></div><div><dt>Проживающих</dt><dd>{account.residents}</dd></div></dl></aside>
      </div>
      <section className={styles.panel} aria-labelledby="charges-title"><div className={styles.sectionHeading}><h2 id="charges-title">Из чего складывается сумма</h2><span className={styles.muted}>Услуг: {account.charges.length}</span></div>
        <ul className={styles.charges}>{account.charges.map(charge => <li key={charge.title}><div><strong>{charge.title}</strong><span>{charge.quantity} × {charge.tariff}</span></div><b>{money(charge.amount)}</b></li>)}</ul>
        <div className={styles.total}><strong>Итого к оплате</strong><strong>{money(total)}</strong></div>
      </section>
      <Meters key={key} meters={account.meters} apartment={house.residentApartment} period={account.readingPeriod} onSave={saveReading} />
    </>}
    </div></SectionPage>;
}
