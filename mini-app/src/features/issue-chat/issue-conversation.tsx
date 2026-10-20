"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ChatPhotoPicker, ChatPhotos } from "@/shared/ui/chat-photos";
import { endpoints } from "@/shared/api/client";
import { useApi } from "@/shared/api/context";
import { array, number, record } from "@/shared/api/parse";
import { Icon } from "@/shared/ui/icon";
import { useOnboarding } from "@/features/onboarding/onboarding";
import { mergeMessages, parseChatMessage, type IssueChatMessage } from "./model";
import styles from "@/shared/ui/chat-screen.module.css";
import { useIssues } from "@/entities/issue";
import { useChatPresence } from "./use-chat-presence";

export function IssueConversation({ issueId }: { issueId: string }) {
  const api = useApi();
  const { preparing } = useOnboarding();
  const [messages, setMessages] = useState<IssueChatMessage[]>([]);
  const { chatDrafts, setChatDraft, chatPhotos, setChatPhotos, chatSending, sendChat } = useIssues();
  const text = chatDrafts[issueId] ?? "";
  const photos = chatPhotos[issueId] ?? [];
  const setText = (value: string) => setChatDraft(issueId, value);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const sending = chatSending.includes(issueId);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const cursor = useRef(0);
  const refreshLock = useRef(false);
  const sendLock = useRef(false);
  const scrollNext = useRef(true);
  const pinBottom = useRef(true);
  const list = useRef<HTMLDivElement>(null);
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
      pinBottom.current = true;
    }
  }, [messages]);

  useEffect(() => {
    const history = list.current;
    if (!history) return;
    const observer = new ResizeObserver(() => {
      if (pinBottom.current) history.scrollTop = history.scrollHeight;
    });
    observer.observe(history);
    return () => observer.disconnect();
  }, []);

  useChatPresence({ issueId, enabled: !preparing, refreshedAt, section, history: list });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sendLock.current || sending) return;
    const trimmed = text.trim();
    if (!trimmed && !photos.length) { setSendError("Напишите сообщение сотруднику УК."); input.current?.focus(); return; }
    sendLock.current = true;
    setSendError("");
    try {
      const message = parseChatMessage(await sendChat(issueId, trimmed, photos));
      scrollNext.current = true;
      setMessages(previous => mergeMessages(previous, [message]));
      // Do not advance the history cursor: there may be an unread staff reply before this ID.
      void refresh();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Не удалось отправить сообщение. Повторите попытку.");
    } finally {
      sendLock.current = false;
    }
  }

  return <section id="issue-chat" ref={section} className={styles.conversation} aria-label="Чат с управляющей компанией">
    <div ref={list} className={styles.scrollArea} role="region" tabIndex={0} aria-label="Переписка с УК" onScroll={event => { const history = event.currentTarget; pinBottom.current = history.scrollHeight - history.scrollTop - history.clientHeight < 80; }}>
      <div className={styles.privacy}><Icon name="lock" size={14} /><span>Переписку по обращению видите только вы и сотрудники вашей УК.</span><button className={styles.headerAction} type="button" onClick={() => void refresh()} aria-label="Обновить переписку"><Icon name="refresh" size={18} /></button></div>
      {loading && !messages.length && <p className={styles.privacy} role="status">Загружаем переписку…</p>}
      {!loading && !loadError && !messages.length && <div className={styles.empty}><Icon name="messages" size={30} /><h3>Есть вопрос по обращению?</h3><p>Уточните детали или спросите о ходе работ.<br />Если чат закрыт, бот пришлёт уведомление об ответе.</p></div>}
      <ol className={styles.history} aria-label="Сообщения по обращению" aria-live="polite" aria-relevant="additions">
        {messages.map(message => <li key={message.id} data-message-id={message.id} className={message.direction === "resident" ? styles.outgoing : styles.incoming}>
          <small>{message.direction === "resident" ? "Вы" : `${message.author} · УК`}</small>
          <ChatPhotos photos={message.photos} onLoad={() => { if (pinBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }} /><p>{message.text}</p>
          <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
        </li>)}
      </ol>
      {loadError && <p className={styles.error} role="alert">{loadError} <button type="button" onClick={() => void refresh()}>Повторить загрузку</button></p>}
    </div>
    <form onSubmit={submit} className={styles.composer}>
      <label className={styles.field}><span className={styles.srOnly}>Сообщение в УК</span><textarea ref={input} value={text} onChange={event => { setText(event.target.value); setSendError(""); }} maxLength={1500} rows={2} placeholder="Напишите сотруднику УК…" disabled={sending} aria-invalid={!!sendError} aria-describedby={sendError ? "issue-chat-send-error" : "issue-chat-hint"} /></label>
      <ChatPhotoPicker photos={photos} onChange={items => setChatPhotos(issueId, items)} disabled={sending} />
      {sendError && <p id="issue-chat-send-error" role="alert">{sendError} Текст сохранён — можно попробовать ещё раз.</p>}
      <div className={styles.composeFooter}><small id="issue-chat-hint">{text.length} / 1500</small><button className={styles.send} type="submit" disabled={sending || (!text.trim() && !photos.length)}><Icon name="send" size={17} />{sending ? "Отправляем…" : "Отправить"}</button></div>
    </form>
  </section>;
}
