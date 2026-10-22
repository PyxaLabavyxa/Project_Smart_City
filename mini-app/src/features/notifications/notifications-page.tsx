"use client";
import { useCallback, useState } from "react";
import { useApi } from "@/shared/api/context";
import { number, record } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import { useHouseSelection } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import { SectionPage } from "@/shared/ui/navigation";
import { notificationDate, notificationHref, parseInbox, type Notification } from "./model";
import { useNotifications } from "./provider";
import styles from "./notifications.module.css";
import { notificationApartment } from "./target";
import { conversationHref } from "@/shared/api/conversation-route";

export function NotificationsPage() {
  const [unread, setUnread] = useState(true);
  return <NotificationFeed key={String(unread)} unread={unread} setUnread={setUnread} />;
}

function NotificationFeed({ unread, setUnread }: { unread: boolean; setUnread: (value: boolean) => void }) {
  const api = useApi();
  const { count, update, navigate } = useNotifications();
  const load = useCallback(async (signal: AbortSignal) => {
    const page = parseInbox(await api(`/me/inbox?unread_only=${unread}`, { signal }));
    if (!signal.aborted) update(page.unreadCount);
    return page;
  }, [api, unread, update]);
  const state = useRemote(load);
  const [extra, setExtra] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<number | null | undefined>();
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { house, choices, choose, refreshHomes } = useHouseSelection();
  const next = cursor === undefined ? state.data?.nextCursor : cursor;
  const items = [...(state.data?.items ?? []), ...extra].filter((item, index, list) => list.findIndex(row => row.id === item.id) === index);
  function reload() { setExtra([]); setCursor(undefined); setReadIds(new Set()); state.reload(); }
  async function more() {
    if (!next || busy) return;
    setBusy(true); setError("");
    try {
      const page = parseInbox(await api(`/me/inbox?unread_only=${unread}&before=${next}`));
      setExtra(value => [...value, ...page.items]); setCursor(page.nextCursor); update(page.unreadCount);
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось загрузить уведомления"); }
    finally { setBusy(false); }
  }
  async function mark(item?: Notification) {
    if (busy || !state.data?.snapshotId) return false;
    setBusy(true); setError("");
    try {
      const result = record(await api(item ? `/me/inbox/${item.id}/read` : "/me/inbox/read-all", { body: item ? {} : { through_id: state.data.snapshotId } }));
      const unreadCount = number(result.unread_count);
      update(unreadCount);
      if (unread && unreadCount === 0) setCursor(null);
      setReadIds(value => new Set([...value, ...(item ? [item.id] : items.filter(row => row.id <= state.data!.snapshotId).map(row => row.id))]));
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось отметить уведомление"); return false; }
    finally { setBusy(false); }
  }
  async function open(item: Notification) {
    const href = notificationHref(item.href);
    if (!href) return;
    let target = notificationApartment(choices, item.houseId, item.apartmentId, house.residentApartmentId);
    if (item.houseId && !target) {
      setBusy(true); setError("");
      try { target = notificationApartment(await refreshHomes(), item.houseId, item.apartmentId, house.residentApartmentId); }
      catch { setError("Не удалось проверить доступ к квартире. Повторите попытку."); return; }
      finally { setBusy(false); }
    }
    if (item.houseId && !target) { setError("Квартира этого дома больше не привязана. Добавьте её в профиле, чтобы открыть раздел."); return; }
    if (!item.readAt && !readIds.has(item.id) && !await mark(item)) return;
    if (target && (house.id !== target.houseId || house.residentApartmentId !== target.id)) choose(target.id);
    const neighbour = /^\/messages\/([1-9]\d*)$/.exec(href);
    navigate(neighbour && target ? conversationHref(Number(neighbour[1]), target.id) : href);
  }
  const hasUnread = count > 0 && !!state.data?.snapshotId;
  const visible = unread ? items.filter(item => !item.readAt && !readIds.has(item.id)) : items;
  return <SectionPage title="Уведомления" description="Всё важное для вас и вашего дома" backHref={null}>
    <div className={styles.toolbar}><div className={styles.filters} aria-label="Показать уведомления">{[true, false].map(value => <button key={String(value)} type="button" disabled={busy} aria-pressed={unread === value} onClick={() => setUnread(value)}>{value ? "Непрочитанные" : "Все"}</button>)}</div><button className={styles.refresh} type="button" onClick={reload} disabled={busy || state.loading} aria-label="Обновить уведомления"><Icon name="refresh" /></button></div>
    {hasUnread && <button className={styles.readAll} type="button" disabled={busy || state.loading} onClick={() => void mark()}><Icon name="check" size={17} />Отметить все прочитанными</button>}
    {(error || state.error) && <p className={styles.error} role="alert">{error || state.error}</p>}
    {state.loading && !state.data && <p role="status" className={styles.empty}>Загружаем уведомления…</p>}
    {!state.loading && !state.error && !visible.length && <div className={styles.empty}><Icon name={unread ? "check" : "bell"} size={34} /><h2>{unread ? next ? "Эти уведомления прочитаны" : "Всё прочитано" : "Здесь пока тихо"}</h2><p>{unread ? next ? "Нажмите «Показать ещё», чтобы загрузить остальные" : "Новые события появятся здесь. История доступна в разделе «Все»." : "Ответы УК, сообщения соседей и объявления будут собраны здесь"}</p></div>}
    <ul className={styles.list}>{visible.map(item => {
      const fresh = !item.readAt && !readIds.has(item.id);
      const icon = item.kind.includes("message") ? "messages" : item.kind.startsWith("camera") ? "camera" : item.kind === "registration" ? "people" : item.kind === "announcement" ? "bell" : "issues";
      return <li key={item.id} className={`${styles.item} ${fresh ? styles.unread : ""}`}>
        <span className={styles.eventIcon}><Icon name={icon} /></span><div className={styles.content}>
          <div className={styles.meta}><time dateTime={item.createdAt}>{notificationDate(item.createdAt)}</time>{fresh && <span className={styles.dot} aria-label="Непрочитано" />}</div>
          <h2>{item.title}</h2>{item.address && <p className={styles.address}>{item.address}</p>}
          {item.kind === "announcement" && <p className={styles.body}>{item.body}</p>}
          {item.kind === "issue_rejection" && <details className={styles.details}><summary>Причина отклонения</summary><p className={styles.body}>{item.body}</p></details>}
        </div>
        <div className={styles.actions}>{notificationHref(item.href) && <button type="button" className={styles.open} disabled={busy} onClick={() => void open(item)}>Открыть<Icon name="arrow" size={15} /></button>}{fresh && <button className={styles.mark} type="button" disabled={busy} onClick={() => void mark(item)} aria-label={`Отметить прочитанным: ${item.title}`}><Icon name="check" size={17} /><span>Отметить прочитанным</span></button>}</div>
      </li>;
    })}</ul>
    {next != null && <button type="button" className={styles.more} disabled={busy} onClick={() => void more()}>{busy ? "Загружаем…" : "Показать ещё"}</button>}
  </SectionPage>;
}
