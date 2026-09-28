"use client";
import { useIssues } from "@/entities/issue";
import { IssueDetailsPage } from "./issue-details-page";
import { IssueNotFoundPage } from "./issue-not-found-page";
import styles from "./issue-details.module.css";
import { RequestState } from "@/shared/ui/navigation/request-state";
export function IssueDetailsRoute({ id }: { id: string }) {
  const { issues, createdIssueId, dismissCreationNotice, loading, error, reload } = useIssues();
  if (loading || error) return <RequestState loading={loading} error={error} reload={reload} />;
  const issue = issues.find(item => item.id === id);
  return issue ? <>
    {createdIssueId === id && <div className={styles.success} role="status"><div><strong>Обращение создано</strong><p>Место и описание сохранены. Здесь можно следить за статусом.</p></div><button type="button" aria-label="Закрыть подтверждение" onClick={dismissCreationNotice}>×</button></div>}
    <IssueDetailsPage issue={issue} />
  </> : <IssueNotFoundPage />;
}
