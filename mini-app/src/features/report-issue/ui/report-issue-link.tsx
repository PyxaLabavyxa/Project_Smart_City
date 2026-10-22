"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useHouseSelection, type HouseLocation } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { useOnboarding } from "@/features/onboarding/onboarding-context";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";
import { ReportLocationPicker } from "./report-location-picker";
import styles from "./report-issue.module.css";

const subscribeToPortal = () => () => {};
const portalRoot = () => document.body;
const serverPortalRoot = () => null;

export function ReportIssueLink() {
  const portal = useSyncExternalStore<HTMLElement | null>(subscribeToPortal, portalRoot, serverPortalRoot);
  const dialog = useRef<HTMLDialogElement>(null);
  const { house, selected } = useHouseSelection();
  const [place, setPlace] = useState<HouseLocation>(selected);
  const { startAt } = useIssues();
  const router = useRouter();
  const { activeTarget } = useOnboarding();
  useEffect(() => {
    const sheet = dialog.current;
    if (activeTarget !== "issue-location" || !sheet || sheet.open) return;
    // Keep the real selector below the onboarding modal, as in the current design.
    sheet.show();
    return () => sheet.close();
  }, [activeTarget, portal]);
  return <>
    <button data-tour="report-issue" type="button" className={styles.primary} aria-haspopup="dialog" onClick={() => {
      setPlace({ houseId: house.id, entrance: selected.entrance, floor: selected.floor, zone: "corridor" });
      if (!dialog.current?.open) dialog.current?.showModal();
    }}><Icon name="plus" />Создать обращение</button>
    {portal && createPortal(<dialog data-motion="sheet" ref={dialog} className={styles.sheet} data-tour-preview={activeTarget === "issue-location" || undefined} aria-labelledby="create-issue-title" onClick={event => {
      if (event.target !== event.currentTarget) return;
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.current?.close();
    }}>
      <div className={styles.handle} aria-hidden="true" /><BrandWordmark className={styles.sheetBrand} />
      <button className={styles.close} aria-label="Закрыть создание обращения" type="button" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
      <h2 id="create-issue-title">Создать обращение</h2><p className={styles.subtitle}>Расскажите, что случилось.</p>
      <h3>Где возникла проблема?</h3>
      <p className={styles.houseAddress}><Icon name="pin" size={20} /><span>{house.address}</span></p>
      <ReportLocationPicker value={place} onChange={setPlace} tourTarget="issue-location" />
      <button className={styles.primary} type="button" onClick={() => { startAt(place); dialog.current?.close(); router.push("/issues/new"); }}>Продолжить</button>
    </dialog>, portal)}
  </>;
}
