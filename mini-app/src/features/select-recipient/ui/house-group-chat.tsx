"use client";
import { useCallback, useEffect, useRef } from "react";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { useRemote } from "@/shared/api/use-remote";
import { Icon } from "@/shared/ui/icon";
import { openHouseChat, parseHouseChat } from "../model/house-chat";
import styles from "./house-group-chat.module.css";

export function HouseGroupChat({ houseId }: { houseId: string }) {
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => parseHouseChat(await api(endpoints.houseChat(houseId), { signal })), [api, houseId]);
  const state = useRemote(load);
  const refresh = useRef(state.reload);
  useEffect(() => { refresh.current = state.reload; }, [state.reload]);
  useEffect(() => {
    const reload = () => { if (!document.hidden) refresh.current(); };
    const timer = window.setInterval(reload, 60000);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", reload); document.removeEventListener("visibilitychange", reload); };
  }, []);

  const initial = state.loading && !state.data;
  const chat = !state.error ? state.data : undefined;
  const url = chat?.joinUrl;
  const subtitle = initial ? "Загружаем чат…" : state.error ? "Не удалось проверить доступность" : chat?.status === "available" ? "Открыть группу в MAX" : chat?.status === "unavailable" ? "Временно недоступен. Попробуйте позже" : chat?.status === "link_missing" ? "Ссылка на группу пока не добавлена" : "УК ещё не подключила чат этого дома";
  const content = <><span className={styles.avatar}><Icon name="people" size={25} /></span><span className={styles.text}><span className={styles.title}>Общий чат дома <span className={styles.badge}>MAX</span></span><span className={styles.subtitle}>{subtitle}</span></span></>;
  return <li data-tour="house-group-chat" className={styles.row} data-available={!!url || undefined} aria-busy={initial}>
    {url ? <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть общий чат дома в MAX: ${chat?.title}`} onClick={event => {
      const bridge = (window as Window & { WebApp?: { initData?: string; openMaxLink?: (url: string) => void } }).WebApp;
      if (openHouseChat(url, bridge)) event.preventDefault();
    }}>{content}<span className={styles.pinned} title="Чат дома закреплён"><Icon name="pushpin" size={19} /></span></a> : <div className={styles.placeholder}>{content}{state.error && <button type="button" className={styles.retry} disabled={state.loading} onClick={state.reload} aria-label="Повторить загрузку домового чата"><Icon name="refresh" size={19} /></button>}</div>}
  </li>;
}
