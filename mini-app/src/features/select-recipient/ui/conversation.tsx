"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { HouseLocation } from "@/entities/house";
import { useMessages } from "@/entities/message";
import styles from "./recipient-selector.module.css";
import { Icon } from "@/shared/ui/icon";
const suggestions = ["Здравствуйте!", "У вас есть вода?", "Не шумите, пожалуйста", "Спасибо!"];
export function Conversation({ place }: { place: HouseLocation & { zone: "apartment" } }) {
  const { messages, drafts, sending, setDraft, send } = useMessages();
  const saving = sending.includes(place.apartment);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const historyList = useRef<HTMLOListElement>(null);
  const text = drafts[place.apartment] ?? "";
  const history = messages.filter(message => message.apartment === place.apartment);
  useEffect(() => { const list = historyList.current; if (list) list.scrollTop = list.scrollHeight; }, [history.length]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || saving) return;
    if (!text.trim()) { setError("Введите сообщение"); input.current?.focus(); return; }
    lock.current = true; setError("");
    try { await send(place, text); } catch (error) { setError(error instanceof Error ? error.message : "Не удалось отправить сообщение. Повторите попытку."); }
    finally { lock.current = false; }
  }
  return <section className={styles.conversation} aria-label={"Переписка с квартирой " + place.apartment}>
    <ol ref={historyList} className={styles.history} aria-live="polite" tabIndex={history.length ? 0 : undefined} aria-label="История сообщений">{history.map(message => <li key={message.id} className={message.direction === "outgoing" ? styles.outgoing : styles.incoming}><small>{message.direction === "outgoing" ? "Вы" : "Квартира " + place.apartment}</small><p>{message.text}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
    {!history.length && <div className={styles.empty}><Icon name="messages" size={32} /><h3>Начните разговор</h3><p>Напишите соседу по домашнему вопросу.<br />Будьте внимательны и вежливы друг к другу.</p></div>}
    <div className={styles.suggestions} aria-label="Быстрые фразы">{suggestions.map(suggestion => <button className={styles.chip} key={suggestion} type="button" disabled={saving} onClick={() => { setDraft(place.apartment, (text ? text + " " + suggestion : suggestion).slice(0, 2000)); setError(""); input.current?.focus(); }}>{suggestion}</button>)}</div>
    <form onSubmit={submit}>
      <label className={styles.field}>Сообщение<textarea ref={input} value={text} onChange={event => { setDraft(place.apartment, event.target.value); setError(""); }} maxLength={2000} rows={3} placeholder="Напишите сообщение соседу…" disabled={saving} aria-invalid={!!error} aria-describedby={error ? "message-error" : undefined} /></label>
      {error && <p id="message-error" role="alert">{error}</p>}
      <div className={styles.composeFooter}><small>{text.length} / 2000</small><button className={styles.send} disabled={saving} type="submit"><Icon name="send" size={17} />{saving ? "Отправляем…" : "Отправить"}</button></div>
    </form>
  </section>;
}
