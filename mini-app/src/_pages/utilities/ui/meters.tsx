"use client";
import { useRef, useState, type FormEvent } from "react";
import { meterLabels, meterUnit, readingError, type Meter } from "@/entities/utilities";
import { Icon } from "@/shared/ui/icon";
import styles from "./utilities.module.css";

export function Meters({ meters, apartment, period, onSave }: { meters: Meter[]; apartment: number; period: string; onSave: (id: string, value: string) => Promise<void> }) {
 const [values,setValues] = useState<Record<string,string>>(() => Object.fromEntries(meters.map(m => [m.id,String(m.current ?? "")])));
 const [errors,setErrors] = useState<Record<string,string>>({});
 const [saved,setSaved] = useState<Record<string,string>>({});
 const [saving,setSaving] = useState(false);
 const [notice,setNotice] = useState("");
 const lock = useRef(false);
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if(lock.current) return;
  const entries=meters.filter(m => values[m.id]?.trim() && values[m.id] !== saved[m.id] && (m.current === undefined || Number(values[m.id].replace(",",".")) !== m.current));
  if(!entries.length) { setNotice("Введите новые показания хотя бы одного счётчика."); return; }
  const invalid=Object.fromEntries(entries.flatMap(m => { const error=readingError(values[m.id],m.previous); return error ? [[m.id,error]] : []; }));
  setErrors(invalid); setNotice("");
  if(Object.keys(invalid).length) { requestAnimationFrame(() => document.getElementById(Object.keys(invalid)[0])?.focus()); return; }
  lock.current=true;setSaving(true);
  let failures=0;
  for(const meter of entries) {
   try { await onSave(meter.id,values[meter.id]); setSaved(current => ({...current,[meter.id]:values[meter.id]})); }
   catch(error) { failures++;setErrors(current => ({...current,[meter.id]:error instanceof Error ? error.message : "Не удалось передать показание"})); }
  }
  setNotice(failures ? "Часть показаний не передана. Проверьте сообщения у счётчиков и повторите отправку." : "Показания переданы.");
  lock.current=false;setSaving(false);
 }
 return <form onSubmit={submit} noValidate aria-label={`Показания квартиры ${apartment} за ${period}`} aria-busy={saving}>
  <p className={styles.meterNotice}><Icon name="calendar" size={30} /><span>Передавайте показания до 25 числа,<br />чтобы они были учтены в этом месяце.</span></p>
  <div className={styles.meterGrid}>{meters.map(meter => <section data-tour="meter-reading" key={meter.id} className={styles.meter}>
   <div className={styles.meterHeading}><span className={styles.meterIcon} data-kind={meter.kind}><Icon name={meter.kind === "cold" ? "droplet" : meter.kind === "hot" ? "heat" : "electricity"} size={29} /></span><div><h3>{meterLabels[meter.kind]}</h3><p>Предыдущие показания<strong>{meter.previous.toLocaleString("ru-RU")} {meterUnit(meter.kind)}</strong></p></div></div>
   <label className={styles.meterField} htmlFor={meter.id}><span>Новые показания</span><span className={styles.meterInput}><input id={meter.id} disabled={saving} inputMode="decimal" maxLength={11} value={values[meter.id] ?? ""} placeholder={String(meter.previous).replace(".",",")} aria-invalid={!!errors[meter.id]} aria-describedby={errors[meter.id] ? `${meter.id}-error` : undefined} onChange={event => {setValues(current => ({...current,[meter.id]:event.target.value}));setErrors(current => ({...current,[meter.id]:""}));setNotice("");}} /><span>{meterUnit(meter.kind)}</span></span></label>
   {errors[meter.id] && <p className={styles.error} id={`${meter.id}-error`} role="alert">{errors[meter.id]}</p>}
   {saved[meter.id] && saved[meter.id]===values[meter.id] && <p className={styles.saved}>Передано</p>}
  </section>)}</div>
  {!meters.length && <p className={styles.notice}>Счётчики пока не добавлены в лицевой счёт.</p>}
  {notice && <p className={styles.feedback} role="status">{notice}</p>}
  {meters.length>0 && <div className={styles.meterActions}><button type="submit" className={styles.primary} disabled={saving}>{saving ? "Передаём показания…" : "Передать показания"}</button></div>}
 </form>;
}
