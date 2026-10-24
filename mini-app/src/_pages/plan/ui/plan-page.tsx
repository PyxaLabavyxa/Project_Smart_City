"use client";
import { HouseExplorer } from "@/features/explore-house";
import { useHouseSelection, parseLocation, locationQuery } from "@/entities/house";
import styles from "./plan-page.module.css";
import Link from "next/link";
import { Icon } from "@/shared/ui/icon";
import { planReturn } from "@/shared/api/plan-return";
import { HouseAddress } from "@/widgets/house-address";

export function PlanPage({ params = {} }: { params?: Record<string, string | string[] | undefined> }) {
  const { house } = useHouseSelection();
  const initialPlace = parseLocation(house, params);
  const back = planReturn(params.returnTo);
  return <><Link href={back.href} className={styles.back} aria-label={`Назад: ${back.label}`}><Icon name="back" />{back.label}</Link><header className={styles.heading}><div><h1>План этажа</h1><HouseAddress compact showMeta={false} /></div>
</header>
    {params.zone && !initialPlace && <p role="status">Место из ссылки отсутствует в текущей структуре. Выберите другое помещение.</p>}
    <HouseExplorer key={`${house.id}:${initialPlace ? locationQuery(initialPlace) : "selected"}`} initialPlace={initialPlace} />
  </>;
}
