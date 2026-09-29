"use client";
import { useCallback } from "react";
import { useHouseSelection } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { array, number, record, string } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import { RequestState } from "@/shared/ui/navigation/request-state";
import styles from "./home-page.module.css";

export function HouseWorks() {
  const { house } = useHouseSelection();
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => array(await api(endpoints.works(house.id), { signal, cacheFor: 60000 }), value => {
    const w = record(value);
    return { id: number(w.id), title: string(w.title), at: string(w.starts_at), location: string(w.location) };
  }), [api, house.id]);
  const state = useRemote(load);
  return <section className={styles.schedule} aria-labelledby="works"><div className={styles.sectionHead}><h2 id="works">Работы в доме</h2></div>
    <RequestState {...state} />
    {state.data?.slice(0, 2).map(work => <div key={work.id} className={styles.work}><time dateTime={work.at}>{new Date(work.at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" })}</time><div><h3>{work.title}</h3><p>{work.location}</p></div></div>)}
    {!state.loading && !state.error && !state.data?.length && <p className={styles.muted}>Запланированных работ пока нет.</p>}
  </section>;
}
