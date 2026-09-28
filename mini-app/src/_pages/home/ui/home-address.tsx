"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { findApartment, useHouseSelection } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import styles from "./home-address.module.css";

export function HomeAddress({ score }: { score: number | null }) {
  const { house, choices, choose } = useHouseSelection();
  const resident = findApartment(house, house.residentApartment);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return <div className={styles.address}>
    <p className={styles.eyeline}>Мой дом · квартира {house.residentApartment}</p>
    <h1><button className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} aria-controls="house-picker" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>{house.address}<span className={styles.chevron}><Icon name="arrow" size={22} /></span></button></h1>
    <div className={styles.meta}>{resident && <span>Подъезд {resident.entrance} · этаж {resident.floor}</span>}<Link href="/health" className={styles.health} aria-label={`Здоровье дома: ${score} из 100. Подробнее`}><strong>{score ?? "—"}<small>/100</small></strong><span>Здоровье дома</span><Icon name="arrow" size={14} /></Link></div>
    <dialog id="house-picker" ref={dialog} className={styles.sheet} aria-labelledby="house-picker-title" onClose={() => setOpen(false)} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close(); }}>
      <div className={styles.handle} aria-hidden="true" />
      <div className={styles.sheetHeading}><h2 id="house-picker-title">Мои дома</h2><button type="button" className={styles.close} aria-label="Закрыть выбор дома" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      <ul className={styles.list}>{choices.map(choice => <li key={choice.id} aria-current={choice.id === house.residentApartmentId || undefined}><button type="button" className={styles.choice} onClick={() => { dialog.current?.close(); choose(choice.id); }}><span className={styles.houseIcon}><Icon name="home" /></span><span><strong>{choice.address}</strong><span>Квартира {choice.apartment}</span></span>{choice.id === house.residentApartmentId && <Icon name="check" size={20} />}</button></li>)}</ul>
      <p className={styles.hint}>{choices.length === 1 ? "К вашему аккаунту привязана одна квартира." : "Выберите дом и квартиру."}</p>
    </dialog>
  </div>;
}
