"use client";
import Image from "next/image";
import { floorCount, type House, type HouseLocation } from "../model/house";
import styles from "./house-elevation.module.css";

export function HouseElevation({ house, selected, onSelect, problemPlaces = [] }: { house: House; selected: HouseLocation; onSelect: (place: HouseLocation) => void; problemPlaces?: readonly HouseLocation[] }) {
  return <div className={styles.viewport} role="region" aria-label="Схема дома: подъезды и этажи">
    <div className={styles.landscape} aria-hidden="true">
      <div className={styles.treesLeft}><Image src="/images/domoved/house-landscape.webp" alt="" fill sizes="(max-width:760px) 220px, 300px" unoptimized loading="eager" /></div>
      <div className={styles.treesRight}><Image src="/images/domoved/house-landscape.webp" alt="" fill sizes="(max-width:760px) 220px, 300px" unoptimized loading="eager" /></div>
    </div>
    <div className={styles.building}>
      <div className={styles.crown} aria-hidden="true" />
      <div className={styles.facade}>{Array.from({ length: house.floors }, (_, offset) => house.floors - offset).map(floor => {
        const count = floorCount(house, selected.entrance, floor);
        const problem = problemPlaces.some(place => place.entrance === selected.entrance && place.floor === floor);
        return <button key={floor} className={styles.floor} type="button" data-ground={floor === 1 || undefined} title={`Подъезд ${selected.entrance} · этаж ${floor} · ${count} кв.`} aria-label={`Подъезд ${selected.entrance}, этаж ${floor}${problem ? ", есть обращение" : ""}`} aria-pressed={selected.floor === floor} onClick={() => onSelect({ houseId: house.id, entrance: selected.entrance, floor, zone: "corridor" })}>
          <span className={styles.windows} aria-hidden="true">
            {Array.from({ length: Math.min(6, Math.max(2, count)) }, (_, index) => <i key={index}>
              {floor === house.floors && index === 0 && <Image className={styles.gnome} src="/images/domoved/window-gnome.webp" alt="" width={40} height={40} unoptimized loading="eager" />}
            </i>)}
          </span>
          {floor === 1 && <span className={styles.door} aria-hidden="true"><i /><small>{selected.entrance}</small></span>}
          {problem && <span className={styles.problem} aria-hidden="true">!</span>}
          {selected.floor === floor && <span className={styles.pin}>{floor} этаж</span>}
        </button>;
      })}</div>
    </div>
    <div className={styles.base} aria-hidden="true" /><div className={styles.label}>Подъезд {selected.entrance}<span>{selected.entrance} из {house.entrances}</span></div>
  </div>;
}
