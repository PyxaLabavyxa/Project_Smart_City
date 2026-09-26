import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";
import { RecipientSelector } from "@/features/select-recipient";
import { HealthSummary } from "./health-summary";
import { HouseInformation } from "./house-information";
import { company } from "../model/company";
import { Icon } from "@/shared/ui/icon";
import Link from "next/link";
import styles from "./services.module.css";

export function HealthPage() {
  return <SectionPage title="Здоровье дома" description="Состояние систем вашего дома">
    <HealthSummary />
    <NavigationLinks label="Обращения дома" items={[{ href: "/issues", title: "Посмотреть обращения" }]} />
  </SectionPage>;
}

export function MessagesPage({ fromPlan = false }: { fromPlan?: boolean }) {
  return <SectionPage title="Связь с квартирой" description="Телефон и личные контакты остаются скрытыми" backHref={fromPlan ? "/plan" : "/more"} backLabel={fromPlan ? "К плану дома" : "Ещё"}>
    <RecipientSelector />
  </SectionPage>;
}

export function HouseInfoPage() {
  return <SectionPage title="Информация о доме" description="ул. Центральная, 18">
    <HouseInformation />
    <NavigationLinks label="Информация и план" items={[
      { href: "/company", title: "Управляющая компания" },
    ]} />
  </SectionPage>;
}

export function CompanyPage() {
  return <SectionPage title="Управляющая компания" description={company.name}>
    <div className={styles.columns}><section>
      <div className={styles.companyIntro}><span className={styles.icon}><Icon name="company" size={28} /></span><h2>По вопросам вашего дома</h2><p className={styles.muted}>Расскажите о проблеме. В карточке обращения можно следить за статусом и ходом работ.</p></div>
      <Link href="/issues/new?from=company" className={styles.primary}>＋ Сообщить о проблеме</Link>
      <dl className={styles.facts}><div><dt>Часы приёма</dt><dd>{company.hours}</dd></div><div><dt>Адрес приёма</dt><dd>{company.address}</dd></div></dl>
      <Link href="/issues" className={styles.link}>Посмотреть обращения <Icon name="arrow" size={16} /></Link>
    </section><section><h2>Ближайшие работы</h2>{company.works.map(work => <article key={work.date} className={styles.work}><time dateTime={work.date}><strong>{work.day}</strong><small>{work.month}</small></time><div><h3>{work.title}</h3><p>{work.time}</p></div></article>)}</section></div>
  </SectionPage>;
}
