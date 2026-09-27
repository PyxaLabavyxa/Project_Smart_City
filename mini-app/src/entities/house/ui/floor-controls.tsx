"use client";
import type { House } from "../model/house";
import styles from "./house-controls.module.css";
import { NumberChoice } from "./number-choice";

export function FloorControls({ house, entrance, floor, onChange, expanded = false }: {
  house: House;
  entrance: number;
  floor: number;
  onChange: (entrance: number, floor: number) => void;
  expanded?: boolean;
}) {
  expanded = expanded && house.entrances <= 3 && house.floors <= 12;
  return <div className={expanded ? styles.expanded : undefined}><div className={styles.controls}>
    <NumberChoice label="Подъезд" value={entrance} count={house.entrances} onChange={value => onChange(value, floor)} />
    <NumberChoice label="Этаж" value={floor} count={house.floors} onChange={value => onChange(entrance, value)} />
  </div>{expanded && <div className={styles.segments}>
    <div><span>Подъезд</span><div>{Array.from({ length: house.entrances }, (_, index) => <button key={index} type="button" aria-label={`Подъезд ${index + 1}`} aria-pressed={entrance === index + 1} onClick={() => onChange(index + 1, floor)}>{String(index + 1).padStart(2, "0")}</button>)}</div></div>
    <div><span>Этаж</span><div>{Array.from({ length: house.floors }, (_, index) => <button key={index} type="button" aria-label={`Этаж ${index + 1}`} aria-pressed={floor === index + 1} onClick={() => onChange(entrance, index + 1)}>{index + 1}</button>)}</div></div>
  </div>}</div>;
}
