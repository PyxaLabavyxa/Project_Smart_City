import { MessagesPage } from "@/_pages/services";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  return <MessagesPage from={from === "plan" || from === "home" ? from : undefined} />;
}
