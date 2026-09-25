"use client";
import type { House } from "../model/house";
import styles from "./house-controls.module.css";

export function FloorControls({ house, entrance, floor, onChange }: {
  house: House;
  entrance: number;
  floor: number;
  onChange: (entrance: number, floor: number) => void;
}) {
  return <div className={styles.controls}>
    <label>Подъезд<select value={entrance} onChange={event => onChange(Number(event.target.value), floor)}>
      {Array.from({ length: house.entrances }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
    </select></label>
    <label>Этаж<select value={floor} onChange={event => onChange(entrance, Number(event.target.value))}>
      {Array.from({ length: house.floors }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
    </select></label>
  </div>;
}
