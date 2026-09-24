import Link from "next/link";
import { ReportIssueForm } from "@/features/report-issue";
import styles from "@/_pages/home/ui/home-page.module.css";
export default function NewIssuePage() {
  return <><Link href="/issues" className={styles.back}>← Все обращения</Link><header className={styles.heading}><div><h1>Сообщить о проблеме</h1><p>ул. Центральная, 18</p></div></header><ReportIssueForm /></>;
}
