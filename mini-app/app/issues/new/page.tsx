import Link from "next/link";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";
import { ReportIssueForm } from "@/features/report-issue";
import styles from "@/features/report-issue/ui/report-issue.module.css";

export default async function NewIssuePage({ searchParams }: {
  searchParams: Promise<{ from?: string | string[]; camera?: string | string[] }>;
}) {
  const { from, camera } = await searchParams;
  const sourceCamera = from === "camera" && typeof camera === "string" && /^[1-9][0-9]*$/.test(camera) ? camera : undefined;
  const back = from === "plan" ? { href: "/plan", label: "К плану дома" }
    : sourceCamera ? { href: `/cameras/${sourceCamera}`, label: "К камере" }
    : { href: "/issues", label: "Все обращения" };
  return <div className={styles.page}><header className={styles.pageHeader}><Link href={back.href} aria-label={`Назад: ${back.label}`}><Icon name="back" size={24} /></Link><BrandWordmark /><Link href={back.href} aria-label="Закрыть создание обращения"><Icon name="close" size={24} /></Link></header><h1 className={styles.srOnly}>Создать обращение</h1><ReportIssueForm cancelHref={back.href} /></div>;
}
