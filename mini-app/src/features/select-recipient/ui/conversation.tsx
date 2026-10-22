"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChatPhotoPicker, ChatPhotos } from "@/shared/ui/chat-photos";
import type { HouseLocation } from "@/entities/house";
import { useHouseSelection } from "@/entities/house";
import { useConversationRead } from "./use-conversation-read";
import { useMessages } from "@/entities/message";
import styles from "@/shared/ui/chat-screen.module.css";
import { Icon } from "@/shared/ui/icon";
const suggestions = ["Здравствуйте!", "У вас есть вода?", "Не шумите, пожалуйста", "Спасибо!"];
export function Conversation({ place, readOnly }: { place: HouseLocation & { zone: "apartment" }; readOnly?: string }) {
  const { messages, drafts, photoDrafts, setPhotoDraft, sending, setDraft, send } = useMessages();
  const saving = sending.includes(place.apartment);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const historyList = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousMessage = useRef<string | undefined>(undefined);
  const text = drafts[place.apartment] ?? "";
  const photos = photoDrafts[place.apartment] ?? [];
  const history = messages.filter(message => message.apartment === place.apartment);
  const lastMessage = history.at(-1);
  const { house } = useHouseSelection();
  useConversationRead(house.residentApartmentId, place.apartment, historyList, history.map(message => message.id).join(","));
  useEffect(() => {
    const list = historyList.current;
    if (list && (!previousMessage.current || nearBottom.current || lastMessage?.direction === "outgoing")) {
      list.scrollTop = list.scrollHeight;
      nearBottom.current = true;
    }
    previousMessage.current = lastMessage?.id;
  }, [lastMessage?.id, lastMessage?.direction]);
  useEffect(() => {
    const list = historyList.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || saving || readOnly) return;
    if (!text.trim() && !photos.length) { setError("Введите сообщение"); input.current?.focus(); return; }
    lock.current = true; setError("");
    try { await send(place, text, photos); } catch (error) { setError(error instanceof Error ? error.message : "Не удалось отправить сообщение. Повторите попытку."); }
    finally { lock.current = false; }
  }
  return <section className={styles.conversation} aria-label={"Переписка с квартирой " + place.apartment}>
    <div ref={historyList} className={styles.scrollArea} role="region" tabIndex={0} aria-label="Переписка" onScroll={event => { const list = event.currentTarget; nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80; }}>
    <p className={styles.privacy}><Icon name="lock" size={14} />В чате виден только номер квартиры. Телефоны и личные контакты скрыты.</p>
    <ol className={styles.history} aria-live="polite" aria-relevant="additions" aria-label="История сообщений">{history.map(message => <li key={message.id} data-message-id={message.id} data-direction={message.direction} className={message.direction === "outgoing" ? styles.outgoing : styles.incoming}><small>{message.direction === "outgoing" ? "Вы" : "Квартира " + place.apartment}</small><ChatPhotos photos={message.photos} onLoad={() => { if (nearBottom.current && historyList.current) historyList.current.scrollTop = historyList.current.scrollHeight; }} /><p>{message.text}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
    {!history.length && <div className={styles.empty}><Icon name="messages" size={32} /><h3>Начните разговор</h3><p>Напишите соседу по домашнему вопросу.<br />Будьте внимательны и вежливы друг к другу.</p></div>}
    </div>
    {readOnly ? <p className={styles.readOnly}>{readOnly}</p> : <form className={styles.composer} onSubmit={submit}>
      {!text.length && <div className={styles.suggestions} aria-label="Быстрые фразы">{suggestions.map(suggestion => <button className={styles.chip} key={suggestion} type="button" disabled={saving} onClick={() => { setDraft(place.apartment, suggestion); setError(""); input.current?.focus(); }}>{suggestion}</button>)}</div>}
      <label className={styles.field}><span className={styles.srOnly}>Сообщение</span><textarea ref={input} value={text} onChange={event => { setDraft(place.apartment, event.target.value); setError(""); }} maxLength={2000} rows={2} placeholder="Напишите сообщение соседу…" disabled={saving} aria-invalid={!!error} aria-describedby={error ? "message-error" : "message-length"} /></label>
      <ChatPhotoPicker photos={photos} onChange={items => setPhotoDraft(place.apartment, items)} disabled={saving} />
      {error && <p id="message-error" role="alert">{error}</p>}
      <div className={styles.composeFooter}><small id="message-length">{text.length} / 2000</small><button className={styles.send} disabled={saving || (!text.trim() && !photos.length)} type="submit"><Icon name="send" size={17} />{saving ? "Отправляем…" : "Отправить"}</button></div>
    </form>}
  </section>;
}
