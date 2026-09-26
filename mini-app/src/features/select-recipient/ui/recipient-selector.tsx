"use client";
import { useState } from "react";
import { useHouseSelection } from "@/entities/house";
import { Conversation } from "./conversation";
import { demoHouse, floorApartments, findApartment, formatLocation, FloorControls } from "@/entities/house";
import styles from "./recipient-selector.module.css";

export function RecipientSelector() {
  const house = demoHouse;
  const { selected, select } = useHouseSelection();
  const [selection, setSelection] = useState(() => selected.zone === "apartment" && selected.apartment !== house.residentApartment
    ? { entrance: selected.entrance, floor: selected.floor, apartment: selected.apartment }
    : { entrance: 2, floor: 9, apartment: 69 });
  const apartments = floorApartments(house, selection.entrance, selection.floor);
  const recipient = findApartment(house, selection.apartment);
  function changeFloor(entrance: number, floor: number) {
    const first = floorApartments(house, entrance, floor).find(number => number !== house.residentApartment);
    setSelection({ entrance, floor, apartment: first ?? 0 });
    const place = first ? findApartment(house, first) : null;
    if (place) select(place);
  }
  return <section aria-labelledby="recipient-heading">
    <h2 id="recipient-heading">Выберите квартиру</h2>
    <FloorControls house={house} entrance={selection.entrance} floor={selection.floor} onChange={changeFloor} />
    <label className={styles.field}>Квартира<select value={selection.apartment} onChange={event => {
      const apartment = Number(event.target.value);
      setSelection({ ...selection, apartment });
      const place = findApartment(house, apartment);
      if (place) select(place);
    }}>
      {selection.apartment === 0 && <option value={0}>Нет других квартир на этаже</option>}
      {apartments.map(apartment => <option key={apartment} value={apartment} disabled={apartment === house.residentApartment}>
        Квартира {apartment}{apartment === house.residentApartment ? " · ваша квартира" : ""}
      </option>)}
    </select></label>
    <div className={styles.recipient} aria-live="polite">
      {recipient ? <><h2>Получатель: квартира {selection.apartment}</h2><p>{formatLocation(recipient)}</p></> : <p>Выберите другой этаж, чтобы найти получателя.</p>}
    </div>
    <p className={styles.privacy}>Номера телефонов и личные контакты жильцов скрыты.</p>
    {recipient?.zone === "apartment" && <Conversation key={recipient.apartment} place={recipient} />}
  </section>;
}
