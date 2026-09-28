"use client";
import { useRef, useState, type FormEvent } from "react";
import { meterLabels, meterUnit, readingError, type Meter } from "@/entities/utilities";
import styles from "./utilities.module.css";

function MeterReading({ meter, onSave }: { meter: Meter; onSave: (value: string) => Promise<void> }) {
  const [value, setValue] = useState(String(meter.current ?? ""));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const unit = meterUnit(meter.kind);
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const error = readingError(value, meter.previous);
    setError(error);
    if (error) return;
    lock.current = true; setSaving(true);
    try { await onSave(value); setSaved(true); } catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить показание. Повторите попытку."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <form className={styles.meter} onSubmit={submit} noValidate>
    <div className={styles.row}><h3>{meterLabels[meter.kind]}</h3><span className={styles.unit}>{unit}</span></div>
    <p className={styles.muted}>№ {meter.serial}</p>
    <p className={styles.previous}>Предыдущее показание <strong>{meter.previous.toLocaleString("ru-RU")} {unit}</strong></p>
    <label className={styles.field} htmlFor={meter.id}>Текущее показание
      <input id={meter.id} disabled={saving} inputMode="decimal" maxLength={11} value={value} placeholder="Введите показание" aria-invalid={!!error} aria-describedby={error ? `${meter.id}-error` : undefined} onChange={event => { setValue(event.target.value); setSaved(false); setError(undefined); }} />
    </label>
    {error && <p id={`${meter.id}-error`} role="alert" className={styles.error}>{error}</p>}
    {meter.current !== undefined && <p className={styles.muted}>Расход: {(meter.current - meter.previous).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} {unit}</p>}
    <button className={styles.secondary} disabled={saving || saved || (meter.current !== undefined && value === String(meter.current))}>{saving ? "Сохраняем…" : "Сохранить показание"}</button>
    <p role="status" className={styles.success}>{saved || meter.current !== undefined ? "Показание сохранено на сервере." : ""}</p>
  </form>;
}

export function Meters({ meters, apartment, period, onSave }: { meters: Meter[]; apartment: number; period: string; onSave: (id: string, value: string) => Promise<void> }) {
  return <section aria-labelledby="meters-heading">
    <div className={styles.sectionHeading}><div><h2 id="meters-heading">Счётчики</h2><p className={styles.muted}>Квартира {apartment} · показания за {period}</p></div></div>
    <p className={styles.muted}>Приборы привязаны к лицевому счёту. Здесь можно внести только показания. Если номер или состав приборов неверный, обратитесь к поставщику услуг.</p>
    <div className={styles.meterGrid}>{meters.map(meter => <MeterReading key={meter.id} meter={meter} onSave={value => onSave(meter.id, value)} />)}</div>
    {!meters.length && <p className={styles.notice}>По лицевому счёту нет приборов учёта. Уточните их регистрацию у поставщика услуг.</p>}
  </section>;
}
