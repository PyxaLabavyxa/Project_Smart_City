"use client";
import { useRef, useState, type FormEvent } from "react";
import type { HouseLocation } from "@/entities/house";
import { useMessages } from "@/entities/message";
import styles from "./recipient-selector.module.css";
export function Conversation({ place }: { place: HouseLocation & { zone: "apartment" } }) {
  const { messages, drafts, setDraft, send } = useMessages();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const text = drafts[place.apartment] ?? "";
  const history = messages.filter(message => message.apartment === place.apartment);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!text.trim()) { setError("Введите сообщение"); return; }
    lock.current = true; setSaving(true); setError("");
    try { await send(place, text); } catch (error) { setError(error instanceof Error ? error.message : "Не удалось отправить сообщение. Повторите попытку."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <section className={styles.conversation} aria-label={"Переписка с квартирой " + place.apartment}>
    <p className={styles.privacy}>История и отправка работают локально. Сообщения не доставляются соседям и исчезают после перезагрузки.</p>
    <ol className={styles.history} aria-live="polite">{history.map(message => <li key={message.id} className={message.direction === "outgoing" ? styles.outgoing : styles.incoming}><small>{message.direction === "outgoing" ? "Вы" : "Квартира " + place.apartment}</small><p>{message.text}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
    {!history.length && <p>Сообщений пока нет. Начните разговор.</p>}
    <form onSubmit={submit}>
      <label className={styles.field}>Сообщение<textarea value={text} onChange={event => { setDraft(place.apartment, event.target.value); setError(""); }} maxLength={2000} rows={3} disabled={saving} aria-invalid={!!error} aria-describedby={error ? "message-error" : undefined} /></label>
      {error && <p id="message-error" role="alert">{error}</p>}
      <button className={styles.send} disabled={saving} type="submit">{saving ? "Отправляем…" : "Отправить"}</button>
    </form>
  </section>;
}
