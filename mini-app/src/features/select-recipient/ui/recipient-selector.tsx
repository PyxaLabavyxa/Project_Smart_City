"use client";
import { useRef } from "react";
import { useHouseSelection, demoHouse, floorApartments, findApartment, FloorControls, PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import { Conversation } from "./conversation";
import styles from "./recipient-selector.module.css";

export function RecipientSelector() {
  const { selected, select } = useHouseSelection();
  const dialog = useRef<HTMLDialogElement>(null);
  const resident = findApartment(demoHouse, demoHouse.residentApartment)!;
  const neighbors = floorApartments(demoHouse, resident.entrance, resident.floor).filter(number => number !== demoHouse.residentApartment);
  const recipient = selected.zone === "apartment" && selected.apartment !== demoHouse.residentApartment ? selected : findApartment(demoHouse, neighbors[0])!;
  const apartments = floorApartments(demoHouse, recipient.entrance, recipient.floor);
  function choose(apartment: number) { const place = findApartment(demoHouse, apartment); if (place) select(place); }
  function changeFloor(entrance: number, floor: number) {
    const first = floorApartments(demoHouse, entrance, floor).find(number => number !== demoHouse.residentApartment);
    if (first) choose(first);
  }
  return <div className={styles.layout}>
    <section className={styles.thread} aria-label="Сообщения соседу">
      <div className={styles.recipient}><span className={styles.avatar}>{recipient.zone === "apartment" && recipient.apartment}</span><div><h2>Квартира {recipient.zone === "apartment" && recipient.apartment}</h2><p>Подъезд {recipient.entrance} · {recipient.floor} этаж</p></div><button type="button" className={styles.change} onClick={() => dialog.current?.showModal()}>Изменить квартиру</button></div>
      <p className={styles.privacy}><Icon name="lock" size={16} />Номера телефонов и личные контакты жильцов скрыты.</p>
      {recipient.zone === "apartment" && <Conversation key={recipient.apartment} place={recipient} />}
    </section>
    <aside className={styles.sidebar}><h2>Ваш этаж</h2><p>Подъезд {resident.entrance} · {resident.floor} этаж</p><div className={styles.neighbors}>{neighbors.map(apartment => <button className={styles.chip} key={apartment} type="button" aria-pressed={recipient.zone === "apartment" && recipient.apartment === apartment} onClick={() => choose(apartment)}>Кв. {apartment}</button>)}</div><p>Выберите квартиру, чтобы написать соседу.</p><PlaceLink place={recipient} className={styles.plan}><Icon name="plan" size={18} />Выбрать на плане дома</PlaceLink></aside>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="recipient-heading"><div className={styles.dialogHeading}><h2 id="recipient-heading">Выберите квартиру</h2><button className={styles.close} type="button" aria-label="Закрыть выбор квартиры" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      <FloorControls house={demoHouse} entrance={recipient.entrance} floor={recipient.floor} onChange={changeFloor} />
      <label className={styles.field}>Квартира<select value={recipient.zone === "apartment" ? recipient.apartment : ""} onChange={event => choose(Number(event.target.value))}>{apartments.map(apartment => <option key={apartment} value={apartment} disabled={apartment === demoHouse.residentApartment}>Квартира {apartment}{apartment === demoHouse.residentApartment ? " · ваша квартира" : ""}</option>)}</select></label>
      <button type="button" className={styles.send} onClick={() => dialog.current?.close()}>Открыть разговор</button>
    </dialog>
  </div>;
}
