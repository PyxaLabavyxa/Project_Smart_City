"use client";
import { totalApartments, findApartment, useHouseSelection, FloorControls, HouseElevation, PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import styles from "./services.module.css";

export function HouseInformation() {
  const { house, selected, select } = useHouseSelection();
  const resident = findApartment(house, house.residentApartment);
  return <div className={styles.columns}>
    <section className={styles.house} aria-label="Характеристики дома">
      <p className={styles.muted}>Этажей: {house.floors} · квартир: {totalApartments(house)}</p>
      <HouseElevation house={house} selected={selected} onSelect={select} />
      <FloorControls house={house} entrance={selected.entrance} floor={selected.floor} onChange={(entrance, floor) => select({ houseId: house.id, entrance, floor, zone: "corridor" })} />
      <dl className={styles.facts}>
        <div><dt>Подъезды</dt><dd>{house.entrances}</dd></div><div><dt>Этажи</dt><dd>{house.floors}</dd></div>
        <div><dt>Квартиры</dt><dd>{totalApartments(house)}</dd></div><div><dt>Ваша квартира</dt><dd>{house.residentApartment}<small>{resident ? `Подъезд ${resident.entrance} · этаж ${resident.floor}` : "Нет в текущей структуре"}</small></dd></div>
      </dl>
      <PlaceLink place={selected} className={styles.button}><Icon name="plan" />Открыть план</PlaceLink>
    </section>
    <section><h2>Общие зоны</h2><ul className={styles.zones}>{["Пассажирские лифты", "Лестницы и коридоры", "Общий двор", "Открытая парковка"].map(zone => <li key={zone}><span className={styles.icon}><Icon name="check" /></span>{zone}</li>)}</ul></section>
  </div>;
}
