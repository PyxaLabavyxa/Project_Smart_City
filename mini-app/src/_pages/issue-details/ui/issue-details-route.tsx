"use client";
import { useIssues } from "@/entities/issue";
import { IssueDetailsPage } from "./issue-details-page";
import { IssueNotFoundPage } from "./issue-not-found-page";
export function IssueDetailsRoute({ id }: { id: string }) {
  const { issues } = useIssues();
  const issue = issues.find(item => item.id === id);
  return issue ? <IssueDetailsPage issue={issue} /> : <IssueNotFoundPage />;
}
