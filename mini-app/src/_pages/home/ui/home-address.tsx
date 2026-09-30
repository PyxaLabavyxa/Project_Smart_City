"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { findApartment, useHouseSelection } from "@/entities/house";
import { RegistrationScreen } from "@/features/registration/registration";
import { Icon } from "@/shared/ui/icon";
import styles from "./home-address.module.css";

export function HomeAddress({ score }: { score: number | null }) {
  const { house, choices, choose, refreshHomes } = useHouseSelection();
  const resident = findApartment(house, house.residentApartment);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  return <div className={styles.address}>
    <h1><button data-tour="choose-house" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} aria-controls="house-picker" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>{house.address}<span className={styles.chevron}><Icon name="arrow" size={22} /></span></button></h1>
    <div className={styles.meta}>{resident && <span>Квартира {house.residentApartment} · Подъезд {resident.entrance} · Этаж {resident.floor}</span>}<Link data-tour="house-health" href="/health" className={styles.health} aria-label={`Здоровье дома: ${score} из 100. Подробнее`}><strong>{score ?? "—"}<small>/100</small></strong><span>Здоровье дома</span><Icon name="arrow" size={14} /></Link></div>
    <dialog id="house-picker" ref={dialog} className={styles.sheet} aria-labelledby="house-picker-title" onClose={() => { setOpen(false); setAdding(false); }} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close(); }}>
      <div className={styles.handle} aria-hidden="true" />
      <div className={styles.sheetHeading}><h2 id="house-picker-title">{adding ? "Добавить квартиру" : "Мои квартиры"}</h2><button type="button" className={styles.close} aria-label="Закрыть выбор дома" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      {adding ? <RegistrationScreen additional onApproved={refreshHomes} onComplete={() => setAdding(false)} /> : <>
      <ul className={styles.list}>{choices.map(choice => <li key={choice.id} aria-current={choice.id === house.residentApartmentId || undefined}><button type="button" className={styles.choice} onClick={() => { dialog.current?.close(); choose(choice.id); }}><span className={styles.houseIcon}><Icon name="home" /></span><span><strong>{choice.address}</strong><span>Квартира {choice.apartment}</span></span>{choice.id === house.residentApartmentId && <Icon name="check" size={20} />}</button></li>)}</ul>
      <button type="button" className={styles.addApartment} onClick={() => setAdding(true)}>＋ Добавить ещё квартиру</button>
      <p className={styles.hint}>{choices.length === 1 ? "К вашему аккаунту привязана одна квартира." : "Выберите дом и квартиру."}</p>
      </>}
      {adding && <button className={styles.back} type="button" onClick={() => setAdding(false)}>Назад к моим квартирам</button>}
    </dialog>
  </div>;
}
