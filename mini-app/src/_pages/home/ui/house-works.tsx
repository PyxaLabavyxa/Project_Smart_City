"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHouseSelection } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { array } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { Icon } from "@/shared/ui/icon";
import { activeHouseWorks, houseWorkStatus, parseHouseWork, workPeriod } from "../model/house-work";
import type { HouseWork } from "../model/house-work";
import styles from "./home-page.module.css";

function WorkCard({ work }: { work: HouseWork }) {
  const [open, setOpen] = useState(false);
  const ongoing = houseWorkStatus(work) === "Идут работы";
  return <li className={styles.work}>
    <button type="button" className={styles.workButton} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={`work-${work.id}`} aria-label={`${work.title}. ${open ? "Скрыть" : "Показать"} подробности`}>
      <span className={styles.workIcon}><Icon name="calendar" /></span>
      <span className={styles.workContent}>
        <span className={styles.workStatus} data-ongoing={ongoing}>{ongoing && <span className={styles.workDot} />}{houseWorkStatus(work)}</span>
        <span className={styles.workTitle}>{work.title}</span>
        <span className={styles.workMeta}><Icon name="clock" size={16} /><span>{workPeriod(work)}</span></span>
        {work.endsAt === null && <span className={styles.workUnknown}>Срок окончания уточняется</span>}
        <span className={styles.workMeta}><Icon name="pin" size={16} /><span>{work.location}</span></span>
      </span>
      <span className={styles.workArrow} data-open={open}><Icon name="arrow" size={16} /></span>
    </button>
    <div id={`work-${work.id}`} className={styles.workDetails} hidden={!open}><span className={styles.workAuthor}>Информация от УК</span><p>{work.description || "Дополнительных указаний нет."}</p></div>
  </li>;
}

export function HouseWorks() {
  const { house } = useHouseSelection();
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => array(await api(endpoints.works(house.id), { signal }), parseHouseWork), [api, house.id]);
  const state = useRemote(load);
  const refresh = useRef(state.reload);
  useEffect(() => { refresh.current = state.reload; }, [state.reload]);
  useEffect(() => {
    const reload = () => { if (!document.hidden) refresh.current(); };
    const timer = window.setInterval(reload, 60000);
    window.addEventListener("focus", reload); document.addEventListener("visibilitychange", reload);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", reload); document.removeEventListener("visibilitychange", reload); };
  }, [house.id]);
  const [expanded, setExpanded] = useState(false);
  const works = activeHouseWorks(state.data ?? []);
  return <section className={styles.schedule} aria-labelledby="works"><div className={styles.sectionHead}><h2 id="works">Работы в доме</h2><RefreshButton className={styles.workRefresh} onRefresh={state.reload} loading={state.loading} aria-label="Обновить работы в доме" /></div>
    <RequestState {...state} loading={state.loading && !state.data} />
    {works.length > 0 && <ul className={styles.workList}>{(expanded ? works : works.slice(0, 2)).map(work => <WorkCard key={work.id} work={work} />)}</ul>}
    {works.length > 2 && <button type="button" className={styles.workMore} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Свернуть список" : `Все работы · ${works.length}`}</button>}
    {!state.loading && !state.error && !works.length && <p className={styles.muted}>Запланированных работ пока нет.</p>}
  </section>;
}
