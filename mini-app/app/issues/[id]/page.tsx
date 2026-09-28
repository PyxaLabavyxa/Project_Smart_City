import { IssueDetailsRoute } from "@/_pages/issue-details";
import { notFound } from "next/navigation";
export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id)) notFound();
  return <IssueDetailsRoute id={id} />;
}
