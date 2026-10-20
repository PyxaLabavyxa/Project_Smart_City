import { IssueDetailsRoute } from "@/_pages/issue-details";
import { notFound, redirect } from "next/navigation";
export default async function IssuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ chat?: string | string[] }> }) {
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id)) notFound();
  if ((await searchParams).chat === "1") redirect(`/issues/${id}/chat`);
  return <IssueDetailsRoute id={id} />;
}
