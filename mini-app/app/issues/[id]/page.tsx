import { IssueDetailsRoute } from "@/_pages/issue-details";
import { notFound } from "next/navigation";
import { demoIssues } from "@/entities/issue";
export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!demoIssues.some(issue => issue.id === id) && !/^local-[0-9a-f-]{36}$/.test(id)) notFound();
  return <IssueDetailsRoute id={id} />;
}
