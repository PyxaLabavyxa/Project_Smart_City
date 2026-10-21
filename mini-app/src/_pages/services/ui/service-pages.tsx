import Link from "next/link";
import { SectionPage } from "@/shared/ui/navigation";
import { Icon } from "@/shared/ui/icon";
import { RecipientSelector } from "@/features/select-recipient";
import { HealthSummary } from "./health-summary";
import { HouseInformation } from "./house-information";
import styles from "./health-summary.module.css";

export function HealthPage() {
  return <SectionPage title="Здоровье дома" description="Состояние систем вашего дома">
    <HealthSummary />
    <Link href="/issues" className={styles.allIssues}><Icon name="issues" size={21} /><span>Все обращения дома</span><Icon name="arrow" size={18} /></Link>
  </SectionPage>;
}

export function MessagesPage({ from }: { from?: "plan" | "home" }) {
  return <RecipientSelector openSelected={!!from} />;
}

export function HouseInfoPage() {
  return <SectionPage title="Информация о доме">
    <HouseInformation />
  </SectionPage>;
}
