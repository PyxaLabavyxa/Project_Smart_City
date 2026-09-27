import Link from "next/link";
import { ReportIssueForm } from "@/features/report-issue";
import styles from "@/features/report-issue/ui/report-issue.module.css";
import { demoCameras } from "@/_pages/cameras/model/demo-cameras";
export default async function NewIssuePage({ searchParams }: {
  searchParams: Promise<{ from?: string | string[]; camera?: string | string[] }>;
}) {
  const { from, camera } = await searchParams;
  const sourceCamera = from === "camera" && typeof camera === "string" ? demoCameras.find(item => item.id === camera) : undefined;
  const back = from === "plan" ? { href: "/plan", label: "К плану дома" }
    : sourceCamera ? { href: `/cameras/${sourceCamera.id}`, label: "К камере" }
    : { href: "/issues", label: "Все обращения" };
  return <div className={styles.page}><Link href={back.href} className={styles.back}>← {back.label}</Link><header className={styles.heading}><h1>Сообщить о проблеме</h1><p>ул. Центральная, 18</p></header><ReportIssueForm cancelHref={back.href} /></div>;
}
