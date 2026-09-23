import { notFound } from "next/navigation";
import { demoIssues } from "@/entities/issue";
import { IssueDetailsPage } from "@/_pages/issue-details";

export function generateStaticParams() {
  return demoIssues.map(issue => ({ id: issue.id }));
}

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = demoIssues.find(item => item.id === id);
  if (!issue) notFound();

  return <IssueDetailsPage issue={issue} />;
}
