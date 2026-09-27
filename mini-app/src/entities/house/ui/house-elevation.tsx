"use client";
import type { CSSProperties } from "react";
import { floorCount, type House, type HouseLocation } from "../model/house";
import styles from "./house-elevation.module.css";
export function HouseElevation({ house, selected, onSelect, problemPlaces = [] }: { house: House; selected: HouseLocation; onSelect: (place: HouseLocation) => void; problemPlaces?: readonly HouseLocation[] }) {
  return <div className={styles.viewport} role="region" aria-label="Схема дома: подъезды и этажи">
    <div className={styles.building} style={{ "--wings": house.entrances, "--levels": house.floors, "--building-height": `${Math.min(282, 90 + house.floors * 14)}px` } as CSSProperties}>
      {Array.from({ length: house.entrances }, (_, index) => <div className={styles.wing} key={index} data-selected={selected.entrance === index + 1 || undefined}>
        <div className={styles.crown}><span /></div>
        <div className={styles.facade}><div className={styles.glazing} aria-hidden="true"><i /><i /></div><div className={styles.floors}>{Array.from({ length: house.floors }, (_, offset) => house.floors - offset).map(floor => <button key={floor} type="button" data-quiet={house.floors > 16 && floor % 5 !== 0 || undefined} title={`Подъезд ${index + 1} · этаж ${floor} · ${floorCount(house, index + 1, floor)} кв.`} aria-label={`Подъезд ${index + 1}, этаж ${floor}${problemPlaces.some(place => place.entrance === index + 1 && place.floor === floor) ? ", есть обращение" : ""}`} aria-pressed={selected.entrance === index + 1 && selected.floor === floor} data-floor={selected.floor === floor || undefined} onClick={() => onSelect({ houseId: house.id, entrance: index + 1, floor, zone: "corridor" })}>
          {selected.entrance === index + 1 && selected.floor === floor && <span className={styles.pin}>{floor}<small>этаж</small></span>}
        </button>)}</div></div>
        <button className={styles.entry} type="button" aria-label={`Выбрать подъезд ${index + 1}`} onClick={() => onSelect({ houseId: house.id, entrance: index + 1, floor: selected.floor, zone: "corridor" })}><i aria-hidden="true" /><span>{index + 1}</span></button>
      </div>)}
    </div><div className={styles.base} /><div className={styles.label}>Подъезды <span>{selected.entrance} выбран</span></div>
  </div>;
}
