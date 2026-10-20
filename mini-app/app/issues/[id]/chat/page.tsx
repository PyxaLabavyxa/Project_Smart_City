import { notFound } from "next/navigation";
import { IssueDetailsRoute } from "@/_pages/issue-details";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <IssueDetailsRoute id={id} view="chat" />;
}
