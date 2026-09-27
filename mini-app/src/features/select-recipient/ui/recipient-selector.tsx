"use client";
import { useRef, useState } from "react";
import { useHouseSelection, floorApartments, findApartment, FloorControls, PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import { Conversation } from "./conversation";
import styles from "./recipient-selector.module.css";

export function RecipientSelector() {
  const { house, selected, select } = useHouseSelection();
  const dialog = useRef<HTMLDialogElement>(null);
  const [picker, setPicker] = useState({ entrance: selected.entrance, floor: selected.floor, apartment: 0 });
  const resident = findApartment(house, house.residentApartment);
  const neighbors = floorApartments(house, resident?.entrance ?? selected.entrance, resident?.floor ?? selected.floor).filter(number => number !== house.residentApartment).sort((a,b) => Math.abs(a - house.residentApartment) - Math.abs(b - house.residentApartment)).slice(0,5).sort((a,b) => a-b);
  const recipient = selected.zone === "apartment" && selected.apartment !== house.residentApartment ? selected : findApartment(house, neighbors[0] ?? (house.residentApartment === 1 ? 2 : 1));
  if (!recipient) return <p>В доме нет других квартир для переписки.</p>;
  const apartments = floorApartments(house, picker.entrance, picker.floor);
  function choose(apartment: number) { const place = findApartment(house, apartment); if (place) select(place); }
  function changeFloor(entrance: number, floor: number) {
    const first = floorApartments(house, entrance, floor).find(number => number !== house.residentApartment);
    setPicker({ entrance, floor, apartment: first ?? 0 });
  }
  return <div className={styles.layout}>
    <section className={styles.thread} aria-label="Сообщения соседу">
      <div className={styles.recipient}><span className={styles.avatar}>{recipient.zone === "apartment" && recipient.apartment}</span><div><h2>Квартира {recipient.zone === "apartment" && recipient.apartment}</h2><p>Подъезд {recipient.entrance} · {recipient.floor} этаж</p></div><button type="button" className={styles.change} onClick={() => { setPicker({ entrance:recipient.entrance, floor:recipient.floor, apartment:recipient.zone === "apartment" ? recipient.apartment : 0 }); dialog.current?.showModal(); }}>Изменить квартиру</button></div>
      <p className={styles.privacy}><Icon name="lock" size={16} />Номера телефонов и личные контакты жильцов скрыты.</p>
      {recipient.zone === "apartment" && <Conversation key={recipient.apartment} place={recipient} />}
    </section>
    <aside className={styles.sidebar}><h2>{resident ? "Ваш этаж" : "Квартиры на этаже"}</h2><p>{resident ? `Подъезд ${resident.entrance} · ${resident.floor} этаж` : "Ваша квартира отсутствует в текущей структуре дома."}</p><div className={styles.neighbors}>{neighbors.map(apartment => <button className={styles.chip} key={apartment} type="button" aria-pressed={recipient.zone === "apartment" && recipient.apartment === apartment} onClick={() => choose(apartment)}>Кв. {apartment}</button>)}</div><p>Выберите квартиру, чтобы написать соседу.</p><PlaceLink place={recipient} className={styles.plan}><Icon name="plan" size={18} />Выбрать на плане дома</PlaceLink></aside>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="recipient-heading"><div className={styles.dialogHeading}><h2 id="recipient-heading">Выберите квартиру</h2><button className={styles.close} type="button" aria-label="Закрыть выбор квартиры" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      <FloorControls house={house} entrance={picker.entrance} floor={picker.floor} onChange={changeFloor} />
      <label className={styles.field}>Квартира<select value={picker.apartment} onChange={event => setPicker({ ...picker, apartment:Number(event.target.value) })}>{picker.apartment === 0 && <option value={0}>Нет других квартир на этаже</option>}{apartments.map(apartment => <option key={apartment} value={apartment} disabled={apartment === house.residentApartment}>Квартира {apartment}{apartment === house.residentApartment ? " · ваша квартира" : ""}</option>)}</select></label>
      <button type="button" className={styles.send} disabled={!picker.apartment} onClick={() => { choose(picker.apartment); dialog.current?.close(); }}>Открыть разговор</button>
    </dialog>
  </div>;
}
