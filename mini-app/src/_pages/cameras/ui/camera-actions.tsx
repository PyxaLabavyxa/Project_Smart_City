"use client";
import Link from "next/link";
import { PlaceLink, useHouseSelection, type HouseLocation } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import styles from "./cameras.module.css";
export function CameraActions({ id }: { id: string }) {
  const { house, select } = useHouseSelection();
  const { startAt } = useIssues();
  const entrance = id.startsWith("entrance-") ? Number(id.split("-")[1]) : 1;
  const place: HouseLocation = { houseId:house.id, entrance, floor:1, zone:id === "courtyard" ? "courtyard" : id === "parking" ? "parking" : "entrance" };
  if (entrance > house.entrances) return <p>Подъезд этой камеры отсутствует в текущей структуре дома.</p>;
  return <div><PlaceLink place={place} className={styles.planLink}>Открыть место на плане →</PlaceLink><Link href="/issues/new?from=plan" className={styles.report} onClick={() => { select(place); startAt(place); }}>＋ Сообщить о проблеме</Link></div>;
}
