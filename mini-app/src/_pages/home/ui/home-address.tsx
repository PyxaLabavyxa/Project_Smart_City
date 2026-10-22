"use client";
import { useRef, useState } from "react";
import { findApartment, useHouseSelection } from "@/entities/house";
import { RegistrationScreen } from "@/features/registration/registration";
import { Icon } from "@/shared/ui/icon";
import styles from "./home-address.module.css";

export function HomeAddress({ compact = false, apartmentOnly = false }: { compact?: boolean; apartmentOnly?: boolean }) {
  const { house, choices, choose, refreshHomes } = useHouseSelection();
  const resident = findApartment(house, house.residentApartment);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const AddressHeading = compact ? "div" : "h1";
  const street = house.address.replace(/^г\.\s*Казань,?\s*/, "").replace(/^ул\.\s*/, "");
  return <div className={styles.address} data-compact={compact || undefined}>
    <AddressHeading className={styles.title}><button data-tour="choose-house" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} aria-controls="house-picker" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>{!compact && <svg className={styles.plate} viewBox="0 0 240 86" fill="none" aria-hidden="true"><path d="M13 2H227Q227 12 238 12V74Q227 74 227 84H13Q13 74 2 74V12Q13 12 13 2Z" fill="var(--color-action)" stroke="var(--color-action)" strokeWidth="3"/><path d="M16 6H224Q224 16 234 16V70Q224 70 224 80H16Q16 70 6 70V16Q16 16 16 6Z" stroke="var(--color-on-action)" strokeWidth="1"/></svg>}<span className={styles.addressText}>{!compact && <small>г. Казань</small>}<span>{compact ? house.address : street}</span></span><span className={styles.chevron}><Icon name="arrow" size={22} /></span></button></AddressHeading>
    <div className={styles.meta}>{resident && <span>Квартира {house.residentApartment}{!apartmentOnly && <> · Подъезд {resident.entrance} · Этаж {resident.floor}</>}</span>}</div>
    <dialog data-motion="sheet" id="house-picker" ref={dialog} className={styles.sheet} aria-labelledby="house-picker-title" onClose={() => { setOpen(false); setAdding(false); }} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close(); }}>
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
