"use client";
import type { CSSProperties } from "react";
import { floorCount, type House, type HouseLocation } from "../model/house";
import styles from "./house-elevation.module.css";
export function HouseElevation({ house, selected, onSelect, problemPlaces = [] }: { house: House; selected: HouseLocation; onSelect: (place: HouseLocation) => void; problemPlaces?: readonly HouseLocation[] }) {
  return <div className={styles.viewport} role="region" aria-label="Схема дома: подъезды и этажи">
    <div className={styles.building} style={{ "--wings": 1, "--levels": house.floors, "--building-height": `${Math.min(282, 90 + house.floors * 14)}px` } as CSSProperties}>
      <div className={styles.wing} key={selected.entrance} data-selected>
        <div className={styles.crown}><span /></div>
        <div className={styles.facade}><div className={styles.glazing} aria-hidden="true"><i /><i /></div><div className={styles.floors}>{Array.from({ length: house.floors }, (_, offset) => house.floors - offset).map(floor => <button key={floor} type="button" data-quiet={house.floors > 16 && floor % 5 !== 0 || undefined} title={`Подъезд ${selected.entrance} · этаж ${floor} · ${floorCount(house, selected.entrance, floor)} кв.`} aria-label={`Подъезд ${selected.entrance}, этаж ${floor}${problemPlaces.some(place => place.entrance === selected.entrance && place.floor === floor) ? ", есть обращение" : ""}`} aria-pressed={selected.floor === floor} data-floor={selected.floor === floor || undefined} onClick={() => onSelect({ houseId: house.id, entrance: selected.entrance, floor, zone: "corridor" })}>
          {selected.floor === floor && <span className={styles.pin}>{floor}<small>этаж</small></span>}
        </button>)}</div></div>
        <button className={styles.entry} type="button" aria-label={`Выбрать подъезд ${selected.entrance}`} onClick={() => onSelect({ houseId: house.id, entrance: selected.entrance, floor: selected.floor, zone: "corridor" })}><i aria-hidden="true" /><span>{selected.entrance}</span></button>
      </div>
    </div><div className={styles.base} /><div className={styles.label}>Подъезд {selected.entrance} <span>{selected.entrance} из {house.entrances}</span></div>
  </div>;
}
