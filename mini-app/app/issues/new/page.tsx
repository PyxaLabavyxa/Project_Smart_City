import Link from "next/link";
import { ReportIssueForm } from "@/features/report-issue";
import styles from "@/_pages/home/ui/home-page.module.css";
export default async function NewIssuePage({ searchParams }: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  const back = from === "plan" ? { href: "/plan", label: "К плану дома" }
    : from === "company" ? { href: "/company", label: "Управляющая компания" }
    : { href: "/issues", label: "Все обращения" };
  return <><Link href={back.href} className={styles.back}>← {back.label}</Link><header className={styles.heading}><div><h1>Сообщить о проблеме</h1><p>ул. Центральная, 18</p></div></header><ReportIssueForm cancelHref={back.href} /></>;
}
