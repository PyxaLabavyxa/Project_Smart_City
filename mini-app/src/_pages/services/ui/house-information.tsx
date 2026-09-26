"use client";
import { demoHouse, totalApartments, findApartment, useHouseSelection, FloorControls, PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import styles from "./services.module.css";

export function HouseInformation() {
  const { selected, select } = useHouseSelection();
  const resident = findApartment(demoHouse, demoHouse.residentApartment);
  return <div className={styles.columns}>
    <section className={styles.house} aria-label="Характеристики дома">
      <p className={styles.muted}>{demoHouse.floors} этажей · {totalApartments(demoHouse)} квартиры</p>
      <div className={styles.elevation} aria-label="Выбор этажа дома">{Array.from({ length: demoHouse.entrances }, (_, e) => <div key={e}>
        {Array.from({ length: demoHouse.floors }, (_, f) => demoHouse.floors - f).map(floor => <button key={floor} type="button" aria-label={`Подъезд ${e + 1}, этаж ${floor}`} aria-pressed={selected.entrance === e + 1 && selected.floor === floor} data-floor={selected.floor === floor || undefined} onClick={() => select({ houseId: demoHouse.id, entrance: e + 1, floor, zone: "corridor" })}>{floor}</button>)}
        <span>Подъезд {e + 1}</span>
      </div>)}</div>
      <FloorControls house={demoHouse} entrance={selected.entrance} floor={selected.floor} onChange={(entrance, floor) => select({ houseId: demoHouse.id, entrance, floor, zone: "corridor" })} />
      <dl className={styles.facts}>
        <div><dt>Подъезды</dt><dd>{demoHouse.entrances}</dd></div><div><dt>Этажи</dt><dd>{demoHouse.floors}</dd></div>
        <div><dt>Квартиры</dt><dd>{totalApartments(demoHouse)}</dd></div><div><dt>Ваша квартира</dt><dd>{demoHouse.residentApartment}<small>Подъезд {resident?.entrance} · этаж {resident?.floor}</small></dd></div>
      </dl>
      <PlaceLink place={selected} className={styles.button}><Icon name="plan" />Открыть план</PlaceLink>
    </section>
    <section><h2>Общие зоны</h2><ul className={styles.zones}>{["Два пассажирских лифта", "Лестницы и коридоры", "Общий двор", "Открытая парковка"].map(zone => <li key={zone}><span className={styles.icon}><Icon name="check" /></span>{zone}</li>)}</ul></section>
  </div>;
}
