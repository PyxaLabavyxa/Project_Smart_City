import Link from "next/link";
import { PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import { formatIssueDate, IssueStatus, type IssueRecord } from "@/entities/issue";
import { IssueHistory } from "./issue-history";
import styles from "./issue-details.module.css";
import { IssueWorkflow } from "@/features/manage-issue";
import { IssuePhotos } from "@/entities/issue/ui/issue-photos";

export function IssueDetailsPage({ issue }: { issue: IssueRecord }) {
  return (
    <>
      <Link href="/issues" className={styles.back}><span aria-hidden="true">←</span> Все обращения</Link>
      <header className={styles.heading}>
        <h1>{issue.title}</h1>
        <p className={styles.meta}>{`Обращение № ${issue.id}`} · <time dateTime={issue.createdAt}>{formatIssueDate(issue.createdAt)}</time></p>
      </header>
      <div className={styles.layout}>
        <section className={styles.info} aria-labelledby="issue-information">
          <h2 id="issue-information" className={styles.sectionLabel}>Об обращении</h2>
          <div className={styles.status}><IssueStatus status={issue.status} />{issue.priority === "high" && <span className={styles.priority}>Высокий приоритет</span>}</div>
          <dl className={styles.facts}>
            <div><dt>Адрес</dt><dd>{issue.address}</dd></div>
            <div><dt>Место проблемы</dt><dd>{issue.location}</dd></div>
            <div><dt>Категория</dt><dd>{issue.category}</dd></div>
            <div><dt>Дата создания</dt><dd><time dateTime={issue.createdAt}>{formatIssueDate(issue.createdAt)}</time></dd></div>
          </dl>
          {issue.place && <PlaceLink place={issue.place} className={styles.planAction}><Icon name="plan" />Открыть место на плане</PlaceLink>}
          {!issue.place && <p>Место отсутствует в текущей структуре дома. Исходное описание сохранено.</p>}
          <div className={styles.description}>
            <h2>Описание проблемы</h2>
            <p>{issue.description}</p>
          </div>
          <IssueWorkflow issue={issue} />
          <IssuePhotos issueId={issue.id} ids={issue.photoIds ?? []} />
        </section>
        <IssueHistory issue={issue} />
      </div>
    </>
  );
}
