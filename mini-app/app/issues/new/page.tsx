import Link from "next/link";
import { ReportIssueForm } from "@/features/report-issue";
import styles from "@/features/report-issue/ui/report-issue.module.css";
export default async function NewIssuePage({ searchParams }: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  const back = from === "plan" ? { href: "/plan", label: "К плану дома" }
    : from === "company" ? { href: "/company", label: "Управляющая компания" }
    : { href: "/issues", label: "Все обращения" };
  return <div className={styles.page}><Link href={back.href} className={styles.back}>← {back.label}</Link><header className={styles.heading}><h1>Сообщить о проблеме</h1><p>ул. Центральная, 18</p></header><ReportIssueForm cancelHref={back.href} /></div>;
}
