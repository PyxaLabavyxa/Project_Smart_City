"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { endpoints } from "@/shared/api/client";
import { useApi } from "@/shared/api/context";
import { array, number, record } from "@/shared/api/parse";
import { Icon } from "@/shared/ui/icon";
import { useOnboarding } from "@/features/onboarding/onboarding";
import { mergeMessages, parseChatMessage, type IssueChatMessage } from "./model";
import styles from "./issue-conversation.module.css";
import { useChatPresence } from "./use-chat-presence";

export function IssueConversation({ issueId }: { issueId: string }) {
  const api = useApi();
  const { preparing } = useOnboarding();
  const [messages, setMessages] = useState<IssueChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const cursor = useRef(0);
  const refreshLock = useRef(false);
  const sendLock = useRef(false);
  const pending = useRef<{ text: string; request_id: string } | null>(null);
  const scrollNext = useRef(true);
  const list = useRef<HTMLOListElement>(null);
  const section = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const path = endpoints.issueMessages(issueId);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    try {
      let after = cursor.current;
      const incoming: IssueChatMessage[] = [];
      while (true) {
        const page = record(await api(`${path}?cursor=${after}&limit=100`, { signal }));
        incoming.push(...array(page.items, parseChatMessage));
        if (page.next_cursor === null) break;
        const next = number(page.next_cursor);
        if (!Number.isSafeInteger(next) || next <= after) throw new Error("Не удалось загрузить историю переписки");
        after = next;
      }
      if (signal?.aborted) return;
      cursor.current = incoming.at(-1)?.id ?? cursor.current;
      const history = list.current;
      scrollNext.current = scrollNext.current || !history || history.scrollHeight - history.scrollTop - history.clientHeight < 80;
      setMessages(previous => mergeMessages(previous, incoming));
      setRefreshedAt(Date.now());
      setLoadError("");
    } catch (error) {
      if (!signal?.aborted) setLoadError(error instanceof Error ? error.message : "Не удалось загрузить переписку");
    } finally {
      refreshLock.current = false;
      if (!signal?.aborted) setLoading(false);
    }
  }, [api, path]);

  useEffect(() => {
    if (preparing) return;
    const controller = new AbortController();
    const update = () => { if (document.visibilityState === "visible") void refresh(controller.signal); };
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 10000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [refresh, preparing]);

  useEffect(() => {
    if (scrollNext.current && list.current) {
      list.current.scrollTop = list.current.scrollHeight;
      scrollNext.current = false;
    }
  }, [messages]);

  useEffect(() => {
    if (!preparing && !loading && new URLSearchParams(window.location.search).get("chat") === "1") {
      section.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      section.current?.focus({ preventScroll: true });
    }
  }, [preparing, loading]);

  useChatPresence({ issueId, enabled: !preparing, refreshedAt, section, history: list });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sendLock.current) return;
    const trimmed = text.trim();
    if (!trimmed) { setSendError("Напишите сообщение сотруднику УК."); input.current?.focus(); return; }
    if (!pending.current || pending.current.text !== trimmed) pending.current = { text: trimmed, request_id: crypto.randomUUID() };
    sendLock.current = true;
    setSending(true);
    setSendError("");
    try {
      const message = parseChatMessage(await api(path, { body: pending.current }));
      scrollNext.current = true;
      setMessages(previous => mergeMessages(previous, [message]));
      setText("");
      pending.current = null;
      // Do not advance the history cursor: there may be an unread staff reply before this ID.
      void refresh();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Не удалось отправить сообщение. Повторите попытку.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  return <section id="issue-chat" ref={section} className={styles.chat} tabIndex={-1} aria-labelledby="issue-chat-title">
    <header className={styles.heading}>
      <div className={styles.headingIcon}><Icon name="messages" size={24} /></div>
      <div><h2 id="issue-chat-title">Чат с управляющей компанией</h2><p>Все уточнения по обращению № {issueId} — в одном месте</p></div>
      <button className={styles.refresh} type="button" onClick={() => void refresh()} aria-label="Обновить переписку"><Icon name="refresh" size={21} /></button>
    </header>
    <p className={styles.private}>Переписку видите только вы и сотрудники вашей УК.</p>
    {loading && !messages.length && <p className={styles.notice} role="status">Загружаем переписку…</p>}
    {!loading && !loadError && !messages.length && <div className={styles.empty}><Icon name="messages" size={30} /><h3>Есть вопрос по обращению?</h3><p>Уточните детали или спросите о ходе работ.<br />Ответ появится здесь. Если чат закрыт, бот пришлёт уведомление.</p></div>}
    <ol ref={list} className={styles.history} aria-label="Сообщения по обращению" aria-live="polite" aria-relevant="additions" tabIndex={messages.length ? 0 : undefined}>
      {messages.map(message => <li key={message.id} data-message-id={message.id} className={message.direction === "resident" ? styles.outgoing : styles.incoming}>
        <strong>{message.direction === "resident" ? "Вы" : `${message.author} · УК`}</strong>
        <p>{message.text}</p>
        <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
      </li>)}
    </ol>
    {loadError && <p className={styles.error} role="alert">{loadError} <button type="button" onClick={() => void refresh()}>Повторить загрузку</button></p>}
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="issue-chat-message">Сообщение в УК</label>
      <textarea id="issue-chat-message" ref={input} value={text} onChange={event => { setText(event.target.value); setSendError(""); }} maxLength={1500} rows={3} placeholder="Например: подскажите, когда мастер сможет прийти?" disabled={sending} aria-invalid={!!sendError} aria-describedby={sendError ? "issue-chat-send-error" : "issue-chat-hint"} />
      {sendError && <p id="issue-chat-send-error" className={styles.error} role="alert">{sendError} Текст сохранён — можно попробовать ещё раз.</p>}
      <div className={styles.footer}><small id="issue-chat-hint">{text.length} / 1500 · Только текст</small><button className={styles.send} type="submit" disabled={sending || !text.trim()}><Icon name="send" size={17} />{sending ? "Отправляем…" : "Отправить"}</button></div>
    </form>
  </section>;
}
