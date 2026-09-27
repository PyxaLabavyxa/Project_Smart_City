"use client";
import { useState } from "react";
import Link from "next/link";
import { useHouseSelection, validStructure, totalApartments, floorApartments, floorCount, fallbackLocation, HouseElevation, FloorControls, FloorPlan, type HouseLocation } from "@/entities/house";
import styles from "./structure-editor.module.css";

export function StructureEditor() {
  const { house, selected, applyStructure } = useHouseSelection();
  const [values, setValues] = useState({ entrances: String(house.entrances), floors: String(house.floors), apartmentsPerFloor: String(house.apartmentsPerFloor) });
  const [overrides, setOverrides] = useState({ ...house.overrides });
  const [previewSelection, setPreviewSelection] = useState<HouseLocation>(selected);
  const [countDraft, setCountDraft] = useState({ key: "", value: "" });
  const [message, setMessage] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const base = { ...house, entrances: Number(values.entrances), floors: Number(values.floors), apartmentsPerFloor: Number(values.apartmentsPerFloor), overrides: {} };
  const keptOverrides = Object.fromEntries(Object.entries(overrides).filter(([key]) => { const [e, f] = key.split(":").map(Number); return e <= base.entrances && f <= base.floors; }));
  const candidate = { ...base, overrides: keptOverrides };
  const valid = validStructure(candidate);
  const previewHouse = valid ? candidate : house;
  const place = fallbackLocation(previewHouse, previewSelection);
  const defaultCount = floorCount(previewHouse, place.entrance, place.floor);
  const floorKey = `${place.entrance}:${place.floor}:${defaultCount}`;
  const count = countDraft.key === floorKey ? countDraft.value : String(defaultCount);
  const removed = Object.keys(overrides).length - Object.keys(keptOverrides).length;
  const changed = JSON.stringify({ ...house, overrides: house.overrides ?? {} }) !== JSON.stringify(candidate);
  const errors = { entrances: "Укажите целое число от 1 до 8", floors: "Укажите целое число от 1 до 40", apartmentsPerFloor: "Укажите целое число от 1 до 60" };
  const fields = [{ key: "entrances", label: "Подъездов", max: 8 }, { key: "floors", label: "Этажей в подъезде", max: 40 }, { key: "apartmentsPerFloor", label: "Квартир на типовом этаже", max: 60 }] as const;
  const numbers = floorApartments(previewHouse, place.entrance, place.floor);
  function selectFloor(next: HouseLocation) { setPreviewSelection(next); setCountDraft({ key: "", value: "" }); setOverrideError(""); }
  return <div className={styles.layout}>
    <div><form className={styles.panel} noValidate onSubmit={event => { event.preventDefault(); if (!valid) { setMessage("Проверьте параметры дома."); return; } applyStructure(candidate); setOverrides(keptOverrides); setMessage("Структура дома сохранена. План и номера квартир обновлены."); }}>
      <h2>{house.address}</h2><div className={styles.fields}>{fields.map(field => {
        const n = Number(values[field.key]); const error = !Number.isInteger(n) || n < 1 || n > field.max;
        return <label key={field.key}>{field.label}<input type="number" inputMode="numeric" min={1} max={field.max} required value={values[field.key]} aria-invalid={error} aria-describedby={error ? field.key + "-error" : undefined} onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setMessage(""); }} />{error && <span className={styles.error} id={field.key + "-error"}>{errors[field.key]}</span>}</label>;
      })}</div>
      <div className={styles.presets} aria-label="Типовое количество квартир">{[4, 7, 12, 30].map(n => <button type="button" className={styles.button} key={n} aria-pressed={Number(values.apartmentsPerFloor) === n} onClick={() => { setValues({ ...values, apartmentsPerFloor: String(n) }); setMessage(""); }}>{n} кв.</button>)}</div>
      <p className={styles.summary} aria-live="polite">{valid ? `Квартир в доме: ${totalApartments(house)} → ${totalApartments(candidate)}` : "Заполните параметры, чтобы увидеть новую схему."}</p>
      {removed > 0 && valid && <p className={styles.note}>При применении будут удалены настройки {removed} этажей за пределами новой структуры.</p>}
      {valid && house.residentApartment > totalApartments(candidate) && <p className={styles.note}>Ваша квартира {house.residentApartment} отсутствует в новой структуре. Переписки и обращения сохранятся.</p>}
      <p className={styles.note}>Нумерация последовательная по подъездам и этажам. Изменения вступят в силу после применения; существующие обращения не удаляются.</p>
      <button className={styles.primary} type="submit" disabled={!valid || !changed}>Применить ко всему дому</button>
      <p role="status" className={styles.feedback}>{message}</p>
      <Link href="/plan" className={styles.link}>Открыть план дома →</Link>
    </form>
    <section className={styles.panel}><h2>Отдельный этаж</h2><p className={styles.note}>Выберите этаж в предпросмотре и задайте своё количество квартир.</p>
      <p>Подъезд {place.entrance} · этаж {place.floor}</p>
      <label className={styles.field}>Квартир на этом этаже<input type="number" inputMode="numeric" min={1} max={60} value={count} aria-invalid={!!overrideError} aria-describedby={overrideError ? "override-error" : undefined} onChange={event => { setCountDraft({ key: floorKey, value: event.target.value }); setOverrideError(""); }} /></label>
      {overrideError && <p id="override-error" role="alert" className={styles.error}>{overrideError}</p>}
      <button type="button" className={styles.button} disabled={!valid} onClick={() => { const n = Number(count); if (!Number.isInteger(n) || n < 1 || n > 60) { setOverrideError("Укажите целое число от 1 до 60"); return; } setOverrides({ ...overrides, [`${place.entrance}:${place.floor}`]: n }); setMessage("Настройка этажа добавлена в предпросмотр. Примените изменения ко всему дому."); }}>Добавить в предпросмотр</button>
      <h3>Индивидуальные настройки</h3><ul className={styles.overrides}>{Object.entries(keptOverrides).map(([key, n]) => <li key={key}><span>Подъезд {key.split(":")[0]} · этаж {key.split(":")[1]}<small>{n} кв.</small></span><button type="button" className={styles.button} aria-label={`Вернуть типовой этаж ${key}`} onClick={() => { const next = { ...overrides }; delete next[key]; setOverrides(next); setMessage(""); }}>Убрать</button></li>)}</ul>
      {!Object.keys(keptOverrides).length && <p className={styles.note}>Все этажи типовые.</p>}
      {Object.keys(overrides).length > 0 && <button type="button" className={styles.button} onClick={() => { setOverrides({}); setMessage("Индивидуальные настройки убраны из предпросмотра."); }}>Сбросить все исключения</button>}
    </section></div>
    <section className={styles.preview} aria-label="Предпросмотр структуры"><h2>Предпросмотр</h2><p className={styles.note}>{valid ? "Проверьте этажи и диапазоны номеров перед применением." : "Показана сохранённая структура — исправьте параметры."}</p>
      <HouseElevation house={previewHouse} selected={place} onSelect={selectFloor} />
      <FloorControls house={previewHouse} entrance={place.entrance} floor={place.floor} onChange={(entrance, floor) => selectFloor({ houseId: house.id, entrance, floor, zone: "corridor" })} />
      <p className={styles.summary}>Этаж {place.floor}: кв. {numbers[0]}–{numbers.at(-1)} · всего {numbers.length}</p>
      <FloorPlan house={previewHouse} selected={place} onSelect={setPreviewSelection} />
    </section>
  </div>;
}
