"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useHouseSelection, findApartment, formatLocation } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { useOnboarding } from "@/features/onboarding/onboarding";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";
import styles from "./report-issue.module.css";

const subscribeToPortal = () => () => {};
const portalRoot = () => document.body;
const serverPortalRoot = () => null;

export function ReportIssueLink() {
 const portal = useSyncExternalStore<HTMLElement | null>(subscribeToPortal, portalRoot, serverPortalRoot);
 const dialog = useRef<HTMLDialogElement>(null);
 const [zone,setZone] = useState<"corridor" | "courtyard" | "apartment">("corridor");
 const { house, selected } = useHouseSelection();
 const { startAt } = useIssues();
 const router = useRouter();
 const { activeTarget } = useOnboarding();
 useEffect(() => {
  const sheet = dialog.current;
  if (activeTarget !== "issue-location" || !sheet || sheet.open) return;
  // The tour is the modal layer; show the real selector underneath it.
  sheet.show();
  return () => sheet.close();
 }, [activeTarget]);
 const place = zone === "apartment" ? findApartment(house,house.residentApartment) : { houseId:house.id, entrance:zone === "courtyard" ? 1 : selected.entrance, floor:zone === "courtyard" ? 1 : selected.floor, zone };
 return <>
  <button data-tour="report-issue" type="button" className={styles.primary} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><Icon name="plus" />Создать обращение</button>
  {portal && createPortal(<dialog ref={dialog} className={styles.sheet} aria-labelledby="create-issue-title" onClick={event => { if (event.target === event.currentTarget) { const r=event.currentTarget.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.current?.close(); } }}>
   <div className={styles.handle} aria-hidden="true" /><BrandWordmark className={styles.sheetBrand} />
   <button className={styles.close} aria-label="Закрыть создание обращения" type="button" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
   <h2 id="create-issue-title">Создать обращение</h2><p className={styles.subtitle}>Расскажите, что случилось.</p>
   <h3>Где возникла проблема?</h3>
   <div data-tour="issue-location" className={styles.locations} role="group" aria-label="Место проблемы">{([{zone:"corridor",icon:"door",label:"Подъезд",text:"Общие зоны в подъезде"},{zone:"courtyard",icon:"tree",label:"Двор",text:"Территория возле дома"},{zone:"apartment",icon:"home",label:"Квартира",text:"Внутри вашей квартиры"}] as const).map(item => <button type="button" key={item.zone} aria-pressed={zone === item.zone} onClick={() => setZone(item.zone)}><Icon name={item.icon} size={28} /><span><strong>{item.label}</strong><small>{item.text}</small></span><Icon name={zone === item.zone ? "check" : "arrow"} size={18} /></button>)}</div>
   <p className={styles.locationNote}><Icon name="pin" /><span>Выбранное место<strong>{place ? formatLocation(place) : "Выберите квартиру"}</strong></span></p>
   <button className={styles.primary} type="button" disabled={!place} onClick={() => { if(place) { startAt(place); dialog.current?.close(); router.push("/issues/new"); } }}>Продолжить</button>
  </dialog>, portal)}
 </>;
}
