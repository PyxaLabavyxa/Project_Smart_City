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
  return <div className={styles.page}><ReportIssueForm cancelHref={back.href} cancelLabel={back.label} /></div>;
}
