"use client";
import Link from "next/link";
import { useState } from "react";
import { totalApartments, findApartment, useHouseSelection, PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import styles from "./services.module.css";
export function HouseInformation() {
 const [documentNotice,setDocumentNotice]=useState("");
 const { house,selected }=useHouseSelection(); const resident=findApartment(house,house.residentApartment);
 return <div className={styles.columns}>
  <Link className={styles.address} href="/house"><span className={styles.icon}><Icon name="pin" /></span><span><strong>{house.address.replace(/^г\.\s*Казань,?\s*ул\.\s*/, "")}</strong><small>г. Казань</small></span><Icon name="arrow" /></Link>
  <section className={styles.house}><h2>Характеристики дома</h2><dl className={styles.facts}>
   <div><dt><Icon name="stairs" />Этажей</dt><dd>{house.floors}</dd></div><div><dt><Icon name="door" />Подъездов</dt><dd>{house.entrances}</dd></div><div><dt><Icon name="home" />Квартир</dt><dd>{totalApartments(house)}</dd></div><div><dt><Icon name="calendar" />Год постройки</dt><dd>—</dd></div>
  </dl><PlaceLink place={selected} className={styles.button}><Icon name="plan" />Открыть план этажа</PlaceLink></section>
  <section className={styles.house}><h2>Документы</h2><div className={styles.documents}>{["Правила проживания","Памятка жителя"].map(title=><button type="button" key={title} onClick={()=>setDocumentNotice("Документы УК пока не загружены.")}><Icon name="issues" size={28} /><span><strong>{title}</strong><small>PDF · файл ещё не добавлен</small></span><Icon name="download" size={24} /></button>)}</div>{documentNotice && <p className={styles.muted} role="status">{documentNotice}</p>}</section>
  <details className={styles.zonesDisclosure}><summary>Общие зоны и ваша квартира</summary><p>Квартира {house.residentApartment} · {resident ? `Подъезд ${resident.entrance} · этаж ${resident.floor}` : "Нет в текущей структуре"}</p><section className={styles.house}><h2>Общие зоны</h2><ul className={styles.zones}>{["Пассажирские лифты","Лестницы и коридоры","Общий двор","Открытая парковка"].map(zone => <li key={zone}><Icon name="check" />{zone}</li>)}</ul></section></details>
  <Link href="/contacts" className={styles.address}><span className={styles.icon}><Icon name="phone" /></span><span><strong>Управляющая компания</strong><small>Контакты вашего дома</small></span><Icon name="arrow" /></Link>
 </div>;
}
